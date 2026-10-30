'use client';
import { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square } from 'lucide-react';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';

const MAX_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 160; // ~6 lines

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  onStop: () => void;
}

export function ChatInput({ onSend, disabled, onStop }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { listening, speechSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => setInput(prev => (prev ? `${prev} ${transcript}` : transcript)),
  });

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || disabled) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px' }}>
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask anything about admissions, colleges, scholarships, placements, careers..."
          value={input}
          maxLength={MAX_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="input-editorial"
          style={{ flex: 1, resize: 'none', overflowY: 'auto', lineHeight: 1.5, fontFamily: 'inherit' }}
          disabled={disabled}
          aria-label="Message the AI Counsellor"
        />
        {speechSupported && (
          <button
            type="button"
            onClick={toggleListening}
            className="btn-editorial-secondary"
            style={{ flexShrink: 0, color: listening ? 'var(--accent-blue)' : undefined, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            title={listening ? 'Listening... click to stop' : 'Ask by voice'}
          >
            <Mic size={16} /> {listening ? 'Listening' : ''}
          </button>
        )}
        {disabled ? (
          <button
            type="button"
            onClick={onStop}
            className="btn-editorial-primary"
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            aria-label="Stop generating"
          >
            <Square size={14} fill="currentColor" /> Stop
          </button>
        ) : (
          <button
            type="submit"
            className="btn-editorial-primary"
            disabled={!input.trim()}
            style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        )}
      </div>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
        {input.length}/{MAX_LENGTH}
      </span>
    </form>
  );
}
