import os
import time
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatYandexGPT

load_dotenv()

from app.wakeword import WakeWordListener
from voice_input import record_until_silence, recognize_speech, record_until_silence_immediate
from voice_output import speak_text  # Импортируем функцию для озвучивания

# --- Загрузка RAG-компонентов ---
embeddings_model = HuggingFaceEmbeddings(
    model_name="paraphrase-multilingual-MiniLM-L12-v2"
)

vector_store = Chroma(
    persist_directory="./chroma_db",
    embedding_function=embeddings_model
)

retriever = vector_store.as_retriever(search_kwargs={"k": 3})

# --- Инициализация YandexGPT ---
API_KEY = os.getenv("YC_API_KEY")
FOLDER_ID = os.getenv("YC_FOLDER_ID")

if not API_KEY or not FOLDER_ID:
    raise ValueError("YC_API_KEY и YC_FOLDER_ID должны быть указаны в .env")

chat_model = ChatYandexGPT(
    api_key=API_KEY,
    folder_id=FOLDER_ID,
    model_uri=f"gpt://{FOLDER_ID}/yandexgpt/latest"
)

def ask_agent(question):
    docs = retriever.invoke(question)
    context = "\n\n".join([doc.page_content for doc in docs])
    system_prompt = SystemMessage(
        content=("Ты — эксперт по Data Science, который отвечает на вопросы, "
                 "опираясь исключительно на предоставленный контекст из учебников. ")
    )
    user_prompt = HumanMessage(
        content=f"Контекст из учебника:\n{context}\n\nВопрос: {question}"
    )
    response = chat_model.invoke([system_prompt, user_prompt])
    return response.content

recent_files = []

def cleanup_old_files(max_files=3):
    """Удаляет старые файлы, оставляя только последние max_files"""
    global recent_files
    while len(recent_files) > max_files:
        old_file = recent_files.pop(0)
        if os.path.exists(old_file):
            os.remove(old_file)
            print(f"🗑️ Удалён старый файл: {old_file}")

MODEL_PATH = "models/vosk-model-ru-0.22"  # путь к скачанной модели

if __name__ == "__main__":
    listener = WakeWordListener(model_path=MODEL_PATH, keyword="агент")
    print("🎙️ Агент запущен. Скажите 'Агент'...")

    while True:
        if not listener.wait_for_wakeword():
            continue

        time.sleep(0.5)  # пауза после пробуждения
        audio_file = record_until_silence_immediate()
        if audio_file is None:
            continue

        user_question = recognize_speech(audio_file)
        if not user_question:
            continue

        answer = ask_agent(user_question)
        print(f"❓ Вопрос: {user_question}")
        print(f"🤖 Ответ: {answer}\n")
        speak_text(answer)
        time.sleep(1.5)
        cleanup_old_files()