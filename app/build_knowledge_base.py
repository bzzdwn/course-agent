import os
import json
import hashlib
from pathlib import Path
from langchain_mineru import MinerULoader  # Новый импорт
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

# Конфигурация
DOCS_DIR = "./documents_base"          # папка с PDF-файлами
DB_DIR = "./chroma_db"                # папка для векторной БД
STATE_FILE = "./content/processed_files.json" # файл состояния
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MINERU_TOKEN="sk-Inzwz8lGbToL46UanadH1ZANbyTy4QSKwLkglu5A6WB7aMae"

embeddings_model = HuggingFaceEmbeddings(
    model_name="paraphrase-multilingual-MiniLM-L12-v2"
)

def get_file_hash(filepath):
    """Вычисляет SHA-256 хеш файла."""
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            sha256.update(chunk)
    return sha256.hexdigest()

def load_state():
    """Загружает состояние из JSON-файла."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f)
    return {}

def save_state(state):
    """Сохраняет состояние в JSON-файл."""
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def parse_pdf(filepath):
    """Парсит PDF с помощью MinerU и возвращает список Document."""
    loader = MinerULoader(
        source=filepath,
        mode="precision",
        token=MINERU_TOKEN
    )
    return loader.load()

def main():
    state = load_state()
    processed = state.get("files", {})

    if os.path.exists(DB_DIR) and os.listdir(DB_DIR):
        # Загружаем существующую БД
        vector_store = Chroma(
            persist_directory=DB_DIR,
            embedding_function=embeddings_model
        )
        print(f"📂 Загружена существующая БД из {DB_DIR}")
    else:
        # Создаём новую БД (пока пустую)
        vector_store = Chroma(
            persist_directory=DB_DIR,
            embedding_function=embeddings_model
        )
        print(f"🆕 Создана новая БД в {DB_DIR}")

    pdf_files = list(Path(DOCS_DIR).glob("*.pdf"))
    new_files = []

    for pdf_path in pdf_files:
        fname = pdf_path.name
        current_hash = get_file_hash(pdf_path)

        # Проверяем, был ли файл уже обработан и не изменился ли он
        if fname in processed and processed[fname] == current_hash:
            print(f"⏩ Пропускаем {fname} (уже обработан)")
            continue

        print(f"📄 Обрабатываем {fname}...")
        try:
            # Парсим PDF
            documents = parse_pdf(str(pdf_path))
            if not documents:
                print(f"⚠️ {fname} не содержит текста, пропускаем.")
                continue

            # Разбиваем на чанки
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=CHUNK_SIZE,
                chunk_overlap=CHUNK_OVERLAP,
                length_function=len,
            )
            chunks = text_splitter.split_documents(documents)

            # Добавляем чанки в БД
            vector_store.add_documents(chunks)
            print(f"✅ Добавлено {len(chunks)} чанков из {fname}")

            # Обновляем состояние
            processed[fname] = current_hash
            new_files.append(fname)

        except Exception as e:
            print(f"❌ Ошибка при обработке {fname}: {e}")

    # 4. Сохраняем состояние
    state["files"] = processed
    save_state(state)

    # 5. Сохраняем БД на диск
    vector_store.persist()
    print(f"💾 БД сохранена. Обработано новых файлов: {len(new_files)}")

if __name__ == "__main__":
    main()