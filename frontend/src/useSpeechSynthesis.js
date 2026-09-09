import { useState, useEffect, useCallback } from 'react';

export const useSpeechSynthesis = () => {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Проверяем поддержку API
  useEffect(() => {
    if (!window.speechSynthesis) {
      setIsSupported(false);
      console.warn('Speech Synthesis API не поддерживается в этом браузере.');
    }
  }, []);

  // Загружаем доступные голоса
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      // Выбираем русский голос, если есть, иначе первый попавшийся
      const ruVoice = availableVoices.find(voice => voice.lang.startsWith('ru'));
      setSelectedVoice(ruVoice || availableVoices[0] || null);
    };

    // Для Chrome голоса загружаются асинхронно
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    loadVoices();

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [isSupported]);

  // Функция для озвучивания текста
  const speak = useCallback((text) => {
    if (!isSupported) {
      console.warn('Speech Synthesis не поддерживается');
      return;
    }

    // Отменяем текущую речь, чтобы не накладывалась
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // Сбрасываем флаг, чтобы можно было повторно озвучить
    };
    utterance.onerror = (event) => {
      console.warn('Ошибка синтеза речи:', event);
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  }, [selectedVoice, isSupported]);

  // Остановка речи
  const cancel = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, cancel, isSpeaking, voices, selectedVoice, setSelectedVoice, isSupported };
};