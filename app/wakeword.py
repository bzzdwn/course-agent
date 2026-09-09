import os
import json
from vosk import Model, KaldiRecognizer

MODEL_PATH = "models/vosk-model-ru-0.22"
KEYWORD = "агент"

class WakeWordDetector:
    def __init__(self):
        if not os.path.exists(MODEL_PATH):
            raise FileNotFoundError(f"Модель Vosk не найдена: {MODEL_PATH}")
        try:
            self.model = Model(MODEL_PATH)
            self.recognizer = KaldiRecognizer(self.model, 16000)
            self.recognizer.SetWords(True)
        except Exception as e:
            print(f"Ошибка инициализации Vosk: {e}")
            raise

    def detect(self, audio_bytes: bytes) -> bool:
        if self.recognizer.AcceptWaveform(audio_bytes):
            result = json.loads(self.recognizer.Result())
            text = result.get("text", "").lower()
            if KEYWORD in text:
                return True
        return False

# Глобальный экземпляр
detector = WakeWordDetector()