'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { apiClient, ApiError } from '../../lib/api-client';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, refreshUser, updateUserLocal } = useUserAuth();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const handleResend = async () => {
    if (!user?.email) return;
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      await apiClient.post('/users/me/email/verify/request', { email: user.email }, accessToken);
      setInfo('A new verification code has been sent to your email.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not send verification code.');
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirming(true);
    setError(null);
    try {
      await apiClient.post('/users/me/email/verify/confirm', { token: code.trim() }, accessToken);
      updateUserLocal({ isEmailVerified: true });
      await refreshUser();
      router.push('/profile');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Invalid or expired code.');
    } finally {
      setConfirming(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <div className="auth-shell">
          <div className="card-editorial auth-card">
            <p className="auth-footer-note">
              Please <Link href="/login/student" className="auth-link">sign in</Link> to verify your email.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (user?.isEmailVerified) {
    return (
      <div className="auth-page">
        <div className="auth-shell">
          <div className="card-editorial auth-card">
            <div className="auth-banner" data-tone="success">Your email is already verified.</div>
            <Link href="/profile" className="btn-editorial-primary auth-submit" style={{ textDecoration: 'none' }}>Go to Profile</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <span className="auth-eyebrow">Account Verification</span>
          <h1 className="text-section-title font-serif auth-title">Verify Your Email</h1>
          <p className="auth-subtitle">We&apos;ve sent a verification code to <strong>{user?.email}</strong>. Enter it below.</p>
        </div>

        <div className="card-editorial auth-card">
          {error && <div className="auth-banner" data-tone="error">{error}</div>}
          {info && <div className="auth-banner" data-tone="info">{info}</div>}

          <form className="auth-form" onSubmit={handleConfirm}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="verify-code">Verification Code</label>
              <input
                id="verify-code" type="text" className="input-editorial"
                value={code} onChange={e => setCode(e.target.value)}
                placeholder="Paste the code from your email" required
              />
            </div>
            <button type="submit" className="btn-editorial-primary auth-submit" disabled={confirming} data-loading={confirming}>
              {confirming ? 'Verifying…' : 'Verify Email'}
            </button>
          </form>

          <button type="button" className="auth-link" onClick={handleResend} disabled={sending} style={{ alignSelf: 'center' }}>
            {sending ? 'Sending…' : "Didn't get a code? Resend"}
          </button>

          <p className="auth-footer-note">
            <Link href="/profile" className="auth-link">Skip for now</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
