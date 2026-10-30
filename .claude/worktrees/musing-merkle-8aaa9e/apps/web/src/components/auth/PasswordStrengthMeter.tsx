'use client';

function scorePassword(password: string): { level: 'weak' | 'fair' | 'good' | 'strong'; score: number; label: string } {
  if (!password) return { level: 'weak', score: 0, label: '' };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 'weak', score: 1, label: 'Weak' };
  if (score === 2) return { level: 'fair', score: 2, label: 'Fair' };
  if (score <= 4) return { level: 'good', score: 3, label: 'Good' };
  return { level: 'strong', score: 4, label: 'Strong' };
}

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { level, score, label } = scorePassword(password);
  return (
    <div className="auth-strength">
      <div className="auth-strength-track">
        {[1, 2, 3, 4].map(seg => (
          <div key={seg} className="auth-strength-seg" data-active={seg <= score} data-level={level} />
        ))}
      </div>
      {password && (
        <span className="auth-strength-label">
          {label} — use 8+ characters with uppercase, lowercase, a number, and a symbol for a stronger password.
        </span>
      )}
    </div>
  );
}
