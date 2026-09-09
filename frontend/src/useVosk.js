import { useState, useEffect, useRef } from 'react';
import * as Vosk from '@lichess-org/vosk-browser';

export const useVosk = (onResult) => {
  const [isReady, setIsReady] = useState(false);
  const [partialText, setPartialText] = useState('');
  const recognizerRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Проверяем, что Vosk загрузился
        if (!Vosk || !Vosk.loadModel) {
          throw new Error('Vosk не загружен или не поддерживается');
        }

        // Загружаем модель (путь относительно папки public)
        const model = await Vosk.loadModel('/models/vosk-model-ru-0.22');
        const recognizer = new Vosk.Recognizer({ model, sampleRate: 16000 });
        recognizerRef.current = recognizer;

        // Запрашиваем микрофон
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        // Создаём аудио-контекст и процессор
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;
        source.connect(processor);
        processor.connect(audioContext.destination);

        processor.onaudioprocess = (event) => {
          const data = event.inputBuffer.getChannelData(0);
          // Преобразуем float32 в int16
          const int16Array = new Int16Array(data.length);
          for (let i = 0; i < data.length; i++) {
            int16Array[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
          }
          recognizer.acceptWaveform(int16Array.buffer);
        };

        setIsReady(true);
        console.log('✅ Vosk готов к работе');
      } catch (error) {
        console.error('❌ Ошибка инициализации Vosk:', error);
      }
    };

    init();

    return () => {
      // Очистка
      if (processorRef.current) {
        processorRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recognizerRef.current) {
        recognizerRef.current.free();
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      if (recognizerRef.current) {
        // Финальный результат
        const result = recognizerRef.current.getResult();
        if (result && result.text) {
          onResult(result.text);
          setPartialText('');
        }
        // Промежуточный результат
        const partial = recognizerRef.current.getPartialResult();
        if (partial && partial.partial) {
          setPartialText(partial.partial);
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [isReady, onResult]);

  return { isReady, partialText };
};