import os
import wave
import pyaudio
from speechkit import configure_credentials, creds, model_repository

# --- Настройка аутентификации ---
API_KEY = os.environ.get("YC_API_KEY")
if not API_KEY:
    raise ValueError("Укажите YC_API_KEY в .env")

configure_credentials(
    yandex_credentials=creds.YandexCredentials(api_key=API_KEY)
)

def speak_text(text, voice='jane', format='lpcm', sample_rate=16000):
    """
    Синтезирует и воспроизводит речь из текста.
    """
    try:
        model = model_repository.synthesis_model()
        model.voice = voice
        model.format = format
        model.sample_rate_hz = sample_rate

        print("🗣️ Озвучиваю ответ...")
        result = model.synthesize(text)

        # Если результат — AudioSegment (из pydub), экспортируем в байты
        if hasattr(result, 'export'):
            audio_bytes = result.export(format='wav').read()
        else:
            # Иначе считаем, что это уже байты
            audio_bytes = result

        # Сохраняем во временный файл
        with open("content/audiofiles/response.wav", "wb") as f:
            f.write(audio_bytes)

        play_audio("content/audiofiles/response.wav")

    except Exception as e:
        print(f"❌ Ошибка при синтезе: {e}")

def play_audio(file_path):
    """Воспроизводит WAV-файл через динамики."""
    try:
        wf = wave.open(file_path, 'rb')
        p = pyaudio.PyAudio()
        stream = p.open(
            format=p.get_format_from_width(wf.getsampwidth()),
            channels=wf.getnchannels(),
            rate=wf.getframerate(),
            output=True
        )
        data = wf.readframes(1024)
        while data:
            stream.write(data)
            data = wf.readframes(1024)
        stream.stop_stream()
        stream.close()
        p.terminate()
        wf.close()
        print("✅ Озвучивание завершено.")
    except Exception as e:
        print(f"❌ Ошибка при воспроизведении: {e}")