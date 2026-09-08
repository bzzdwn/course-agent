import os
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatYandexGPT

load_dotenv()

from voice_input import record_audio, recognize_speech
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
                 "опираясь исключительно на предоставленный контекст из учебников. "
                 "Если ответа нет в контексте, так и скажи.")
    )
    user_prompt = HumanMessage(
        content=f"Контекст из учебника:\n{context}\n\nВопрос: {question}"
    )
    response = chat_model.invoke([system_prompt, user_prompt])
    return response.content

if __name__ == "__main__":
    print("🎤 Нажмите Enter, чтобы начать запись вопроса...")
    input()

    # 1. Записываем и распознаём вопрос
    audio_file = record_audio()
    user_question = recognize_speech(audio_file)

    if not user_question:
        print("Не удалось распознать вопрос. Попробуйте снова.")
    else:
        # 2. Получаем ответ от агента
        answer = ask_agent(user_question)
        
        print("\n" + "="*50)
        print(f"❓ Вопрос: {user_question}")
        print(f"🤖 Ответ агента:\n{answer}")
        print("="*50)
        
        # 3. Озвучиваем ответ
        speak_text(answer)