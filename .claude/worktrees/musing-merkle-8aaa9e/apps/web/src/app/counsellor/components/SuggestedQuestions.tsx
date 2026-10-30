'use client';

interface Props {
  questions: string[];
  onPick: (question: string) => void;
}

export function SuggestedQuestions({ questions, onPick }: Props) {
  if (questions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Suggested next questions
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {questions.map(q => (
          <button
            key={q}
            onClick={() => onPick(q)}
            className="badge-editorial"
            style={{ cursor: 'pointer', border: '1px solid var(--border-color)', background: 'transparent' }}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
