'use client';
import { Bot } from 'lucide-react';

const SUGGESTIONS: Array<{ emoji: string; label: string; prompt: string }> = [
  { emoji: '🎓', label: 'Predict my admission', prompt: 'What is my admission probability at my shortlisted colleges?' },
  { emoji: '🏫', label: 'Recommend colleges', prompt: 'Which colleges can I get into with my current rank?' },
  { emoji: '💰', label: 'Find scholarships', prompt: 'What scholarships am I eligible for?' },
  { emoji: '📈', label: 'Financial planning', prompt: 'Help me plan the finances for my engineering education, including loan and EMI.' },
  { emoji: '🛣', label: 'Generate a roadmap', prompt: 'Generate a career roadmap for me based on my goals.' },
  { emoji: '📊', label: 'Compare colleges', prompt: 'Compare the top colleges I should consider for my branch.' },
];

export function WelcomeScreen({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="chat-welcome">
      <div className="chat-welcome-mark" aria-hidden="true"><Bot size={30} /></div>
      <h2 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>Hello! I&apos;m your AI Counsellor.</h2>
      <p className="text-body" style={{ maxWidth: '520px', margin: 0 }}>
        Grounded in verified KEA, KCET, COMEDK, and college data. Ask me about admissions, cutoffs,
        scholarships, financial planning, or your career roadmap.
      </p>
      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginTop: '8px' }}>
        What can I help you with today?
      </p>
      <div className="chat-suggestion-grid">
        {SUGGESTIONS.map(s => (
          <button
            key={s.label}
            type="button"
            className="card-editorial chat-suggestion-card"
            onClick={() => onPick(s.prompt)}
          >
            <span className="chat-suggestion-emoji" aria-hidden="true">{s.emoji}</span>
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
