from fastapi import FastAPI, HTTPException, UploadFile, File
from app.wakeword import detector
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from app.agent import ask_agent
from app.slide_generator import generate_slide

app = FastAPI(title="AI Course Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # адрес React-приложения
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QuestionRequest(BaseModel):
    question: str

class AnswerResponse(BaseModel):
    answer: str

class SlideRequest(BaseModel):
    topic: str
    context: str = ""  # история обсуждения (можно передать последние сообщения)

class SlideResponse(BaseModel):
    slide: dict

@app.post("/ask", response_model=AnswerResponse)
async def ask(request: QuestionRequest):
    try:
        answer = ask_agent(request.question)
        return AnswerResponse(answer=answer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/wake")
async def wake(file: UploadFile = File(...)):
    """
    Принимает аудио-фрагмент (PCM, 16 кГц, моно, int16).
    Возвращает {"wake": True} если ключевая фраза обнаружена.
    """
    audio_bytes = await file.read()
    is_wake = detector.detect(audio_bytes)
    return {"wake": is_wake}

@app.post("/generate_slide", response_model=SlideResponse)
async def generate_slide_endpoint(request: SlideRequest):
    try:
        slide = generate_slide(request.topic, request.context)
        return SlideResponse(slide=slide)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))