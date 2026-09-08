import os
import wave
import pyaudio
import numpy as np
import time
import torch
from silero_vad import load_silero_vad
from speechkit import configure_credentials, creds, model_repository
from speechkit.stt import AudioProcessingType

# --- Настройка аутентификации ---
API_KEY = os.environ.get("YC_API_KEY")
if not API_KEY:
    raise ValueError("API_KEY не найден в переменных окружения. Укажите YC_API_KEY в .env")

configure_credentials(
    yandex_credentials=creds.YandexCredentials(api_key=API_KEY)
)

# --- Параметры записи ---
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 512                       # 512 сэмплов = 32 мс
SILENCE_TIMEOUT = 1.5             # секунд тишины для остановки
SPEECH_THRESHOLD = 0.5            # порог вероятности речи
SPEECH_FRAMES_TRIGGER = 3         # сколько подряд речевых фреймов для старта
MAX_DURATION = 60                 # максимальная длительность записи

# Загружаем модель VAD один раз
vad_model = load_silero_vad()

def record_until_silence():
    """
    Ожидает устойчивого начала речи, затем записывает до наступления тишины.
    Возвращает имя сохранённого файла или None.
    """
    p = pyaudio.PyAudio()
    stream = p.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK)

    print("🎤 Ожидание начала речи...")

    frames = []
    recording = False
    speech_frames_count = 0
    silent_frames_count = 0
    silence_limit = int(SILENCE_TIMEOUT * RATE / CHUNK)
    start_time = time.time()

    while True:
        data = stream.read(CHUNK)
        # Преобразуем в int16 и нормализуем в float32 [-1, 1]
        audio_int16 = np.frombuffer(data, dtype=np.int16).copy()
        audio_float = audio_int16.astype(np.float32) / 32768.0

        # Получаем вероятность речи напрямую из модели
        speech_prob_tensor = vad_model(torch.from_numpy(audio_float), RATE)
        speech_prob = speech_prob_tensor.item()

        is_speech = speech_prob > SPEECH_THRESHOLD

        if not recording:
            # Ждём накопления речевых фреймов
            if is_speech:
                speech_frames_count += 1
                if speech_frames_count >= SPEECH_FRAMES_TRIGGER:
                    print("🎤 Начало речи...")
                    recording = True
                    frames = []                # очищаем буфер от шума
                    silent_frames_count = 0
                    speech_frames_count = 0
            else:
                speech_frames_count = 0
        else:
            # В режиме записи — добавляем фрейм в буфер
            frames.append(data)

            if is_speech:
                silent_frames_count = 0        # есть речь — сбрасываем тишину
            else:
                silent_frames_count += 1

            # Останавливаемся при тишине или по таймауту
            if silent_frames_count >= silence_limit or (time.time() - start_time) > MAX_DURATION:
                break

    print("⏹️  Запись завершена.")
    stream.stop_stream()
    stream.close()
    p.terminate()

    if not frames:
        print("⚠️ Речь не была записана.")
        return None

    filename = f"question_{int(time.time())}.wav"
    with wave.open(filename, 'wb') as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(p.get_sample_size(FORMAT))
        wf.setframerate(RATE)
        wf.writeframes(b''.join(frames))

    print(f"💾 Файл сохранён: {filename}")
    return filename

def recognize_speech(audio_file_path):
    """Распознаёт аудиофайл через Yandex SpeechKit (проверенный метод)"""
    try:
        model = model_repository.recognition_model()
        model.model = 'general'
        model.language = 'ru-RU'
        model.audio_processing_type = AudioProcessingType.Full

        result = model.transcribe_file(audio_file_path)
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

# --- Для теста ---
if __name__ == "__main__":
    file = record_until_silence()
    if file:
        text = recognize_speech(file)
        print(f"Вопрос: {text}")