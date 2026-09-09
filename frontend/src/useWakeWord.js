import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export const useWakeWord = (onWake) => {
  const [isActive, setIsActive] = useState(false);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const intervalRef = useRef(null);

  const startWakeDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioContext.destination);

      let buffer = [];

      processor.onaudioprocess = (event) => {
        const data = event.inputBuffer.getChannelData(0);
        // Преобразуем float32 -> int16
        const int16Array = new Int16Array(data.length);
        for (let i = 0; i < data.length; i++) {
          int16Array[i] = Math.max(-32768, Math.min(32767, data[i] * 32768));
        }
        buffer.push(int16Array.buffer);
      };

      // Каждые 500 мс отправляем накопленные фрагменты
      intervalRef.current = setInterval(async () => {
        if (buffer.length === 0) return;
        const combinedLength = buffer.reduce((sum, b) => sum + b.byteLength, 0);
        const combined = new Uint8Array(combinedLength);
        let offset = 0;
        for (const buf of buffer) {
          combined.set(new Uint8Array(buf), offset);
          offset += buf.byteLength;
        }
        buffer = [];

        try {
          const formData = new FormData();
          formData.append('file', new Blob([combined], { type: 'application/octet-stream' }));
          const response = await axios.post('http://localhost:8000/wake', formData);
          if (response.data.wake) {
            onWake();
            stopWakeDetection();
          }
        } catch (error) {
          console.error('Ошибка отправки аудио:', error);
        }
      }, 500);

      setIsActive(true);
    } catch (error) {
      console.error('Ошибка доступа к микрофону:', error);
    }
  };

  const stopWakeDetection = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (processorRef.current) processorRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsActive(false);
  };

  useEffect(() => {
    return () => {
      if (isActive) stopWakeDetection();
    };
  }, []);

  return { isActive, startWakeDetection, stopWakeDetection };
};