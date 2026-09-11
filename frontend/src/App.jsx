import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useWakeWord } from './useWakeWord';
import { useSpeechRecognition } from './useSpeechRecognition';
import './App.css';
import MessageContent from './MessageContent';
import SlideViewer from './SlideViewer';
import SlideThumbnails from './SlideThumbnails';

const STORAGE_KEY = 'ai-assistant-session-v1';

// Загрузка состояния из localStorage
const loadSession = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Ошибка загрузки сессии:', error);
    return null;
  }
};

// Сохранение состояния в localStorage
const saveSession = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn('Ошибка сохранения сессии:', error);
  }
};

function App() {
  const initialSession = loadSession();

  const [messages, setMessages] = useState(initialSession?.messages || []);
  const [slides, setSlides] = useState(initialSession?.slides || []);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(initialSession?.currentSlideIndex || 0);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [wakeError, setWakeError] = useState(false);
  const [isGeneratingSlide, setIsGeneratingSlide] = useState(false);
  const messagesEndRef = useRef(null);

  // Текущий слайд (геттер)
  const currentSlide = slides[currentSlideIndex] || null;

  // Wake Word – автоматический старт
  const onWake = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    startListening();
  };
  const { isActive: isWakeActive, startWakeDetection, stopWakeDetection } = useWakeWord(onWake);

  // Speech Recognition – для команды после пробуждения
  const { isListening, startListening, stopListening, transcript, isSupported: isSpeechSupported } = useSpeechRecognition();

  // TTS
  const speak = (text) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Автозапуск Wake Word при монтировании
  useEffect(() => {
    const initWake = async () => {
      try {
        await startWakeDetection();
        setWakeError(false);
        console.log('✅ Wake Word автоматически активирован');
      } catch (error) {
        console.error('❌ Автозапуск не удался:', error);
        setWakeError(true);
      }
    };
    initWake();

    return () => {
      if (isWakeActive) stopWakeDetection();
    };
  }, []);

  // ===== ФУНКЦИИ ДЛЯ РАБОТЫ СО СЛАЙДАМИ =====

  const generateSlide = async () => {
    const lastMessages = messages.slice(-10);
    const context = lastMessages.map(m => `${m.role}: ${m.content}`).join('\n');
    const lastUserQuestion = messages.filter(m => m.role === 'user').pop()?.content || 'Временные ряды';

    setIsGeneratingSlide(true);
    try {
      const response = await axios.post('/api/generate_slide', {
        topic: lastUserQuestion,
        context: context
      });
      if (response.data && response.data.slide) {
        const newSlide = response.data.slide;
        setSlides((prev) => {
          const next = [...prev, newSlide];
          setCurrentSlideIndex(next.length - 1);
          return next;
        });
      } else {
        throw new Error('Неверный формат ответа от сервера');
      }
    } catch (error) {
      console.error('Ошибка генерации слайда:', error);
      const errorSlide = {
        title: 'Ошибка генерации',
        items: ['Не удалось сгенерировать слайд. Попробуйте позже.'],
        formulas: []
      };
      setSlides((prev) => {
        const next = [...prev, errorSlide];
        setCurrentSlideIndex(next.length - 1);
        return next;
      });
    } finally {
      setIsGeneratingSlide(false);
    }
  };

  const goToPrevSlide = () => {
    if (currentSlideIndex > 0) setCurrentSlideIndex(currentSlideIndex - 1);
  };

  const goToNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) setCurrentSlideIndex(currentSlideIndex + 1);
  };

  const deleteCurrentSlide = () => {
    if (slides.length === 0) return;
    setSlides((prev) => {
      const next = prev.filter((_, i) => i !== currentSlideIndex);
      const newIndex = Math.max(0, Math.min(currentSlideIndex - 1 < 0 ? 0 : currentSlideIndex - 1, next.length - 1));
      setCurrentSlideIndex(next.length === 0 ? 0 : newIndex);
      return next;
    });
  };

  const updateCurrentSlide = (updatedSlide) => {
    setSlides((prev) => {
      const next = [...prev];
      next[currentSlideIndex] = updatedSlide;
      return next;
    });
  };

  const clearSession = () => {
    if (!window.confirm('Очистить всю историю сообщений и слайдов? Это действие нельзя отменить.')) {
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    setMessages([]);
    setSlides([]);
    setCurrentSlideIndex(0);
    console.log('🗑️ Сессия очищена');
  };

  const reorderSlides = (newSlides, newIndex) => {
    setSlides(newSlides);
    setCurrentSlideIndex(newIndex);
  };

  // ===== ОБРАБОТКА РАСПОЗНАННОГО ТЕКСТА =====

  useEffect(() => {
    if (transcript) {
      const text = transcript.toLowerCase().trim();
      const slideKeywords = ['составь слайд', 'сделай слайд', 'сгенерируй слайд', 'покажи слайд'];
      const isSlideCommand = slideKeywords.some(keyword => text.includes(keyword));

      if (isSlideCommand) {
        const userMessage = { role: 'user', content: transcript };
        setMessages(prev => [...prev, userMessage]);
        generateSlide();
        return;
      }

      const question = transcript;
      setInput('');
      const userMessage = { role: 'user', content: question };
      setMessages(prev => [...prev, userMessage]);
      setLoading(true);

      axios.post('/api/ask', { question })
        .then(response => {
          const assistantMessage = { role: 'assistant', content: response.data.answer };
          setMessages(prev => [...prev, assistantMessage]);
          speak(response.data.answer);
        })
        .catch(error => {
          console.error('Ошибка:', error);
          setMessages(prev => [...prev, { role: 'assistant', content: '❌ Ошибка сервера.' }]);
        })
        .finally(() => setLoading(false));
    }
  }, [transcript]);

  // Автоскролл чата
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Автосохранение сессии при изменениях
  useEffect(() => {
    saveSession({
      messages,
      slides,
      currentSlideIndex,
      savedAt: new Date().toISOString(),
    });
  }, [messages, slides, currentSlideIndex]);

  // ===== ОТПРАВКА ТЕКСТОВОГО ВОПРОСА =====

  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('/api/ask', { question });
      const assistantMessage = { role: 'assistant', content: response.data.answer };
      setMessages((prev) => [...prev, assistantMessage]);
      speak(response.data.answer);
    } catch (error) {
      console.error(error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '❌ Ошибка сервера.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSpeakMessage = (text) => speak(text);

  return (
    <div className="app-layout">
      {/* ЛЕВАЯ ПАНЕЛЬ — ЧАТ */}
      <div className="chat-panel">
        <div className="chat-header">
          <h1>📚 AI Ассистент</h1>
          <div className="chat-status">
            {isWakeActive ? '🎤 Пробуждение активно' : (wakeError ? '⚠️ Ошибка' : '⏳ Запуск...')}
            {isListening && <span className="listening">⏺ Слушаю...</span>}
          </div>
        </div>

        <div className="chat-messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.role === 'user' ? 'user' : 'assistant'}`}>
              <div className="avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="bubble">
                <MessageContent text={msg.content} />
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleSpeakMessage(msg.content)}
                    className="speak-btn"
                    title="Озвучить"
                  >
                    🔊
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="message assistant">
              <div className="avatar">🤖</div>
              <div className="bubble typing">
                <span>.</span><span>.</span><span>.</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите вопрос..."
            rows={2}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? '...' : '➤'}
          </button>
        </form>
      </div>

      {/* ПРАВАЯ ПАНЕЛЬ — РЕДАКТОР ПРЕЗЕНТАЦИИ */}
      <div className="slide-panel">
        <div className="slide-toolbar">
          <div className="toolbar-left">
            <h2>📊 Редактор презентации</h2>
            {slides.length > 0 && (
              <span className="slide-counter">
                Слайд {currentSlideIndex + 1} из {slides.length}
              </span>
            )}
          </div>
          <div className="slide-actions">
            <button
              onClick={goToPrevSlide}
              disabled={currentSlideIndex === 0}
              className="btn-nav"
              title="Предыдущий слайд"
            >
              ←
            </button>
            <button
              onClick={goToNextSlide}
              disabled={currentSlideIndex >= slides.length - 1}
              className="btn-nav"
              title="Следующий слайд"
            >
              →
            </button>
            <button
              onClick={deleteCurrentSlide}
              disabled={slides.length === 0}
              className="btn-nav btn-nav-delete"
              title="Удалить текущий слайд"
            >
              🗑
            </button>
            <button
              onClick={clearSession}
              className="btn-clear"
              disabled={messages.length === 0 && slides.length === 0}
              title="Очистить всю сессию"
            >
              🗑 Очистить
            </button>
            <button
              onClick={generateSlide}
              disabled={isGeneratingSlide}
              className="btn-generate"
            >
              {isGeneratingSlide ? '⏳ Генерация...' : '✨ Сгенерировать слайд'}
            </button>
          </div>
        </div>

        

        <div className="slide-canvas">
          {currentSlide ? (
            <SlideViewer slide={currentSlide} onChange={updateCurrentSlide} />
          ) : (
            <div className="slide-placeholder">
              <div className="placeholder-icon">📊</div>
              <h3>Здесь появится ваш слайд</h3>
              <p>Обсудите тему с ассистентом слева, затем нажмите «Сгенерировать слайд» или скажите «Составь слайд»</p>
            </div>
          )}
        </div>
        <SlideThumbnails
          slides={slides}
          currentIndex={currentSlideIndex}
          onSelect={setCurrentSlideIndex}
          onReorder={reorderSlides}
        />
      </div>
    </div>
  );
}

export default App;