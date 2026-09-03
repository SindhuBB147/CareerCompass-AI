'use client';
import { useState } from 'react';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [input, setInput] = useState('');
  const { listening, speechSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => setInput(prev => (prev ? `${prev} ${transcript}` : transcript)),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
      <input
        type="text"
        placeholder="Ask about KCET cutoffs, college fees, placements, scholarships, or the counselling process..."
        value={input}
        onChange={e => setInput(e.target.value)}
        className="input-editorial"
        style={{ flex: 1 }}
        disabled={disabled}
      />
      {speechSupported && (
        <button
          type="button"
          onClick={toggleListening}
          className="btn-editorial-secondary"
          style={{ flexShrink: 0, color: listening ? 'var(--accent-blue)' : undefined }}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          title={listening ? 'Listening... click to stop' : 'Ask by voice'}
        >
          {listening ? '● Listening' : '🎤'}
        </button>
      )}
      <button type="submit" className="btn-editorial-primary" disabled={disabled || !input.trim()} style={{ flexShrink: 0 }}>
        Send →
      </button>
    </form>
  );
}
