'use client';

import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { PasswordField } from '../../components/auth/PasswordField';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resetPassword, isLoading } = useUserAuth();

  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    const result = await resetPassword(email, otp, newPassword);
    setSubmitting(false);

    if (!result.ok) { setError(result.message ?? 'Something went wrong.'); return; }
    setSuccess(true);
    setTimeout(() => router.push('/login/student'), 1800);
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <span className="auth-eyebrow">Account Recovery</span>
          <h1 className="text-section-title font-serif auth-title">Reset Password</h1>
          <p className="auth-subtitle">Enter the 6-digit code we emailed you along with your new password.</p>
        </div>

        <div className="card-editorial auth-card">
          {error && <div className="auth-banner" data-tone="error">{error}</div>}
          {success && <div className="auth-banner" data-tone="success">Password reset. Redirecting you to sign in…</div>}

          {!success && (
            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="rp-email">Email</label>
                <input
                  id="rp-email" type="email" className="input-editorial"
                  value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="rp-otp">Verification Code</label>
                <input
                  id="rp-otp" type="text" inputMode="numeric" maxLength={6}
                  className="input-editorial auth-otp-input"
                  value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000" autoComplete="one-time-code" required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="rp-new">New Password</label>
                <PasswordField id="rp-new" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
                <PasswordStrengthMeter password={newPassword} />
              </div>

              <div className="auth-field">
                <label className="auth-label" htmlFor="rp-confirm">Confirm New Password</label>
                <PasswordField id="rp-confirm" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
              </div>

              <button type="submit" className="btn-editorial-primary auth-submit" disabled={submitting || isLoading} data-loading={submitting}>
                {submitting ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          <p className="auth-footer-note">
            Need a new code? <Link href="/forgot-password" className="auth-link">Request again</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="auth-page"><div className="auth-shell" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
