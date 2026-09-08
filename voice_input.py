import os
import wave
import pyaudio
from speechkit import configure_credentials, creds, model_repository
from speechkit.stt import AudioProcessingType

# --- 1. Настройка аутентификации через API-ключ ---
API_KEY = os.environ.get("YC_API_KEY")
if not API_KEY:
    raise ValueError("API_KEY не найден в переменных окружения. Укажите YC_API_KEY в .env")

configure_credentials(
    yandex_credentials=creds.YandexCredentials(api_key=API_KEY)
)

# --- 2. Параметры записи ---
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 4096
RECORD_SECONDS = 10

def record_audio(filename="question.wav"):
    """Записывает звук с микрофона и сохраняет в WAV-файл."""
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK)

    print(f"🎤 Говорите... (макс. {RECORD_SECONDS} секунд)")
    frames = []

    for _ in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
        data = stream.read(CHUNK)
        frames.append(data)

    print("⏹️  Запись завершена.")
    stream.stop_stream()
    stream.close()
    p.terminate()

    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(p.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))

    return filename

def recognize_speech(audio_file_path):
    try:
        model = model_repository.recognition_model()
        model.model = 'general'
        model.language = 'ru-RU'
        model.audio_processing_type = AudioProcessingType.Full

        with open(audio_file_path, 'rb') as f:
            audio_data = f.read()

        # Используем метод transcribe_file или recognize
        # В новых версиях рекомендуется transcribe_file
        result = model.transcribe_file(audio_file_path)  # или model.recognize(...)
        
        if result:
            recognized_text = result[0].normalized_text if isinstance(result, list) else result
            print(f"📝 Распознано: {recognized_text}")
            return recognized_text
        else:
            print("❌ Речь не распознана.")
            return ""
    except Exception as e:
        print(f"❌ Ошибка при распознавании: {e}")
        return ""

# --- Пример использования ---
if __name__ == "__main__":
    audio_file = record_audio()
    question = recognize_speech(audio_file)
    print(f"Ваш вопрос: {question}")