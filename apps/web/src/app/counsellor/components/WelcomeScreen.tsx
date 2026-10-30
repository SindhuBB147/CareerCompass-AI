'use client';

import { Sparkles, GraduationCap, Building2, BarChart3, Wallet, TrendingUp } from 'lucide-react';

const SUGGESTIONS = [
  {
    icon: GraduationCap,
    label: 'Admission Prediction',
    desc: 'Calculate admission chances across shortlisted colleges',
    prompt: 'What is my admission probability at my shortlisted colleges?',
  },
  {
    icon: Building2,
    label: 'Recommend Colleges',
    desc: 'Find colleges based on rank, category & preferences',
    prompt: 'Which colleges can I get into with my current rank and category?',
  },
  {
    icon: BarChart3,
    label: 'Compare Colleges',
    desc: 'Side-by-side comparison of cutoffs, fees & NIRF',
    prompt: 'Compare the top colleges I should consider for my branch.',
  },
  {
    icon: GraduationCap,
    label: 'Scholarships',
    desc: 'Discover eligible government & private scholarships',
    prompt: 'What scholarships am I eligible for based on my profile?',
  },
  {
    icon: Wallet,
    label: 'Financial Planning',
    desc: 'Education loan EMIs, total fees & living expenses',
    prompt: 'Help me plan the finances for my engineering education, including loan and EMI.',
  },
  {
    icon: TrendingUp,
    label: 'Career Roadmap',
    desc: 'Semester-wise skill, project & certification strategy',
    prompt: 'Generate a career roadmap for me based on my goals.',
  },
];

export function WelcomeScreen({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="chat-welcome">
      <div className="chat-welcome-mark" aria-hidden="true">
        <Sparkles size={28} style={{ flexShrink: 0 }} />
      </div>

      <h2 className="font-serif" style={{ fontSize: '26px', margin: 0, color: 'var(--text-primary)' }}>
        How can I help you with your career journey?
      </h2>

      <p className="text-body" style={{ maxWidth: '560px', margin: 0, color: 'var(--text-secondary)', fontSize: '15px' }}>
        Ask about colleges, admissions, scholarships, courses, finances, or career planning.
      </p>

      <div className="chat-suggestion-grid">
        {SUGGESTIONS.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              type="button"
              className="card-editorial chat-suggestion-card"
              onClick={() => onPick(s.prompt)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '18px 20px',
                textAlign: 'left',
                border: '1px solid var(--border-color)',
                borderRadius: '16px',
                backgroundColor: 'var(--card-bg, #ffffff)',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
                <span className="chat-suggestion-icon" style={{ color: 'var(--accent-blue)', display: 'flex', alignItems: 'center' }}>
                  <Icon size={18} style={{ flexShrink: 0 }} />
                </span>
                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {s.label}
                </span>
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {s.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
