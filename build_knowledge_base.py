import os
from langchain_mineru import MinerULoader  # Новый импорт
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma

# 1. Загрузка PDF с помощью MinerU
# По умолчанию используется режим "flash", он быстрый и не требует токена[reference:5]
loader = MinerULoader(
    source="ts1.pdf",
    mode="precision",
    token="sk-Inzwz8lGbToL46UanadH1ZANbyTy4QSKwLkglu5A6WB7aMae"  # или установите переменную окружения MINERU_TOKEN
)

# Загружаем документ. Результат - список объектов Document LangChain.
documents = loader.load()

# 2. Разбивка на чанки (оставляем без изменений)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=1000,
    chunk_overlap=200,
    length_function=len,
)
chunks = text_splitter.split_documents(documents)

# 3. Создание эмбеддингов (без изменений)
embeddings_model = HuggingFaceEmbeddings(
    model_name="paraphrase-multilingual-MiniLM-L12-v2"
)

# 4. Создание и сохранение локальной векторной БД (без изменений)
vector_store = Chroma.from_documents(
    documents=chunks,
    embedding=embeddings_model,
    persist_directory="./chroma_db"
)

vector_store.persist()

print("База знаний успешно создана с помощью MinerU и сохранена локально!")