'use client';

// Compact icon+text login button. Renders as a button (not a plain Link) so
// a click can show a brief pending/disabled state for the client-side route
// transition to /login/student — this is a navigation Link underneath, not
// an auth call itself, so "loading" here means "transitioning," not a
// fabricated auth-request delay.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function HeaderLoginButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (pending) return;
    setPending(true);
    router.push('/login/student');
  };

  return (
    <button
      type="button"
      className={`btn-editorial-secondary site-login-btn ${className}`}
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? <span className="site-login-spinner" aria-hidden="true" /> : <span aria-hidden="true">🔐</span>}
      <span>{pending ? 'Loading…' : 'Login'}</span>
    </button>
  );
}
