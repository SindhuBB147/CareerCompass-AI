'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { forgotPassword, isLoading } = useUserAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await forgotPassword(email);
    setSubmitting(false);
    if (!result.ok) { setError(result.message ?? 'Something went wrong.'); return; }
    setSent(true);
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <span className="auth-eyebrow">Account Recovery</span>
          <h1 className="text-section-title font-serif auth-title">Forgot Password</h1>
          <p className="auth-subtitle">
            Enter the email on your account and we'll send a one-time code to reset your password.
          </p>
        </div>

        <div className="card-editorial auth-card">
          {error && <div className="auth-banner" data-tone="error">{error}</div>}

          {sent ? (
            <>
              <div className="auth-banner" data-tone="success">
                If <strong>{email}</strong> is registered, a 6-digit verification code has been sent. It expires in 10 minutes.
              </div>
              <Link href={`/reset-password?email=${encodeURIComponent(email)}`} className="btn-editorial-primary auth-submit" style={{ textDecoration: 'none' }}>
                Enter Code
              </Link>
            </>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="fp-email">Email</label>
                <input
                  id="fp-email"
                  type="email"
                  className="input-editorial"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>
              <button type="submit" className="btn-editorial-primary auth-submit" disabled={submitting || isLoading} data-loading={submitting}>
                {submitting ? 'Sending code…' : 'Send Reset Code'}
              </button>
            </form>
          )}

          <p className="auth-footer-note">
            Remembered your password? <Link href="/login/student" className="auth-link">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
