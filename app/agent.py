import os
from dotenv import load_dotenv
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.chat_models import ChatYandexGPT

load_dotenv()

try:
    embeddings_model = HuggingFaceEmbeddings(
        model_name="paraphrase-multilingual-MiniLM-L12-v2"
    )

    vector_store = Chroma(
        persist_directory="./chroma_db",
        embedding_function=embeddings_model
    )
except Exception as e:
    print(f"Ошибка инициализации: {e}")
    raise

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

def ask_agent(question: str) -> str:
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