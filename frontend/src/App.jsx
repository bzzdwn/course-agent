import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useWakeWord } from './useWakeWord';
import { useSpeechRecognition } from './useSpeechRecognition';
import './App.css';
import MessageContent from './MessageContent';

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [wakeError, setWakeError] = useState(false);
  const messagesEndRef = useRef(null);

  // Wake Word – автоматический старт
  const onWake = () => {
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

  // Когда распознан текст (команда)
// Когда распознан финальный текст (команда), отправляем мгновенно
useEffect(() => {
  if (transcript) {
    const question = transcript;
    // Очищаем поле ввода (опционально)
    setInput('');
    
    // Добавляем сообщение пользователя в чат
    const userMessage = { role: 'user', content: question };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);

    // Отправляем запрос напрямую
    axios.post('http://localhost:8000/ask', { question })
      .then(response => {
        const assistantMessage = { role: 'assistant', content: response.data.answer };
        setMessages(prev => [...prev, assistantMessage]);
        speak(response.data.answer);
      })
      .catch(error => {
        console.error('Ошибка:', error);
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Ошибка сервера.' }]);
      })
      .finally(() => {
        setLoading(false);
      });
  }
}, [transcript]);

  // Автоскролл чата
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Отправка вопроса
  const handleSubmit = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    const userMessage = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/ask', { question });
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

  // Ручное озвучивание сообщения (кнопка остаётся у каждого сообщения)
  const handleSpeakMessage = (text) => speak(text);

  return (
    <div className="app">
      <div className="chat-header">
        <h1>📚 AI Ассистент</h1>
        <p>по Data Science</p>
        <div style={{ fontSize: '14px', marginTop: '6px', opacity: 0.8, display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>
            {isWakeActive ? '🎤 Пробуждение активно' : (wakeError ? '⚠️ Ошибка пробуждения' : '⏳ Запуск...')}
          </span>
          {isListening && <span style={{ color: '#e0e7ff' }}>⏺ Слушаю команду...</span>}
          {wakeError && (
            <span style={{ color: '#f87171' }}>
              Не удалось запустить голосовое пробуждение. Разрешите доступ к микрофону и перезагрузите страницу.
            </span>
          )}
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
                  style={{
                    marginLeft: '10px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '16px',
                    color: '#4f8cf7',
                  }}
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
    </div>
  );
}

export default App;