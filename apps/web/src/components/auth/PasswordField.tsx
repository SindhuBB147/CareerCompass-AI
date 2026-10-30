'use client';

import { useState } from 'react';

export function PasswordField({
  id,
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete = 'current-password',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="auth-input-wrap">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        className="input-editorial"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
      />
      <button
        type="button"
        className="auth-password-toggle"
        onClick={() => setVisible(v => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        tabIndex={-1}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
