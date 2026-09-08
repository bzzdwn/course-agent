import threading
import queue
import sounddevice as sd
import json
import numpy as np
from vosk import Model, KaldiRecognizer

class WakeWordListener:
    def __init__(self, model_path, keyword="агент"):
        self.keyword = keyword.lower()
        self.detected = threading.Event()
        self.audio_queue = queue.Queue()
        self.sample_rate = 16000
        
        # Загружаем модель Vosk
        self.model = Model(model_path)
        self.rec = KaldiRecognizer(self.model, self.sample_rate)
        self.rec.SetWords(False)  # Нам нужен только текст

    def audio_callback(self, indata, frames, time, status):
        if status:
            print(f"⚠️ Audio callback status: {status}")
        # indata — это int16, преобразуем в байты
        audio = indata[:, 0].astype(np.int16).tobytes()
        self.audio_queue.put(audio)

    def run(self):
        with sd.InputStream(
            samplerate=self.sample_rate,
            channels=1,
            dtype='int16',
            callback=self.audio_callback,
            blocksize=4000  # ~250 мс
        ):
            while not self.detected.is_set():
                try:
                    data = self.audio_queue.get(timeout=0.1)
                except queue.Empty:
                    continue
                
                # Если распознан полный фрагмент
                if self.rec.AcceptWaveform(data):
                    res = json.loads(self.rec.Result())
                    text = res.get('text', '')
                    if self.keyword in text.lower():
                        print(f"🔊 Пробуждение! ({text})")
                        self.detected.set()
                        return
                else:
                    # Частичный результат (для более быстрой реакции)
                    partial = json.loads(self.rec.PartialResult())
                    text = partial.get('partial', '')
                    if self.keyword in text.lower():
                        print(f"🔊 Пробуждение (частичное)! ({text})")
                        self.detected.set()
                        return

    def wait_for_wakeword(self, timeout=None):
        self.detected.clear()
        thread = threading.Thread(target=self.run)
        thread.start()
        if timeout:
            result = self.detected.wait(timeout=timeout)
        else:
            self.detected.wait()
            result = True
        thread.join(timeout=1)
        return result