'use client';

import { useEffect, useRef, useState } from 'react';
import { Mic, Paperclip, Send, Square } from 'lucide-react';
import { useSpeechRecognition } from '../../../hooks/useSpeechRecognition';

const MAX_LENGTH = 2000;
const MAX_TEXTAREA_HEIGHT = 160;

interface Props {
  onSend: (text: string) => void;
  disabled: boolean;
  onStop: () => void;
}

export function ChatInput({ onSend, disabled, onStop }: Props) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setInput(prev => (prev ? `${prev}\n[Attached: ${file.name}]` : `[Attached document: ${file.name}] `));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-color)',
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
        aria-label="Upload document"
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px',
          backgroundColor: 'var(--card-bg, #ffffff)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '8px 12px 8px 16px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
          transition: 'border-color 0.2s ease',
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Ask about colleges, admissions, scholarships, careers..."
          value={input}
          maxLength={MAX_LENGTH}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            resize: 'none',
            overflowY: 'auto',
            lineHeight: 1.5,
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            border: 'none',
            outline: 'none',
            backgroundColor: 'transparent',
            color: 'var(--text-primary)',
            padding: '4px 0',
          }}
          disabled={disabled}
          aria-label="Message the AI Counsellor"
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="chat-action-btn"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              color: 'var(--text-secondary)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            aria-label="Attach document or resume"
            title="Attach document or resume"
          >
            <Paperclip size={16} style={{ flexShrink: 0 }} />
          </button>

          {speechSupported && (
            <button
              type="button"
              onClick={toggleListening}
              className="chat-action-btn"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                color: listening ? 'var(--accent-blue)' : 'var(--text-secondary)',
                backgroundColor: listening ? 'rgba(45, 110, 163, 0.1)' : 'transparent',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
              title={listening ? 'Listening... click to stop' : 'Ask by voice'}
            >
              <Mic size={16} style={{ flexShrink: 0 }} />
            </button>
          )}

          {disabled ? (
            <button
              type="button"
              onClick={onStop}
              className="btn-editorial-primary"
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
              aria-label="Stop generating"
            >
              <Square size={12} fill="currentColor" style={{ flexShrink: 0 }} /> Stop
            </button>
          ) : (
            <button
              type="submit"
              className="btn-editorial-primary"
              disabled={!input.trim()}
              style={{
                width: '36px',
                height: '36px',
                padding: 0,
                borderRadius: '50%',
                opacity: !input.trim() ? 0.4 : 1,
                cursor: !input.trim() ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              aria-label="Send message"
            >
              <Send size={15} style={{ flexShrink: 0 }} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          Press <kbd style={{ padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '10px' }}>Enter</kbd> to send, <kbd style={{ padding: '2px 4px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '10px' }}>Shift + Enter</kbd> for line break
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          {input.length}/{MAX_LENGTH}
        </span>
      </div>
    </form>
  );
}
