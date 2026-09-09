import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

const MessageContent = ({ text }) => {
  if (!text) return null;

  // Простой парсер: ищем \[...\] и \(...\)
  const parts = text.split(/(\\\[.*?\\\]|\\\(.*?\\\))/g);

  return parts.map((part, idx) => {
    if (part.startsWith('\\[') && part.endsWith('\\]')) {
      const math = part.slice(2, -2);
      return <BlockMath key={idx} math={math} />;
    } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
      const math = part.slice(2, -2);
      return <InlineMath key={idx} math={math} />;
    } else {
      // Обычный текст
      return <span key={idx} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    }
  });
};

export default MessageContent;