'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { OAuthButtons } from '../../../components/auth/OAuthButtons';
import { PasswordField } from '../../../components/auth/PasswordField';

export default function StudentLoginPage() {
  const router = useRouter();
  const {
    user, isAuthenticated, login, loginWithGoogle, logoutUser, isLoading, loginError, clearLoginError,
    pendingTwoFactor, verifyTwoFactor, cancelTwoFactor,
  } = useUserAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [trustThisDevice, setTrustThisDevice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile = await login(email, password, rememberMe);
    if (profile) router.push(profile.onboardingCompleted ? '/profile' : '/onboarding');
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    const profile = await verifyTwoFactor(twoFactorCode, trustThisDevice);
    if (profile) router.push(profile.onboardingCompleted ? '/profile' : '/onboarding');
  };

  const handleGoogleCredential = async (idToken: string) => {
    const profile = await loginWithGoogle(idToken);
    if (profile) router.push(profile.onboardingCompleted ? '/profile' : '/onboarding');
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <span className="auth-eyebrow">Student Authentication</span>
          <h1 className="text-section-title font-serif auth-title">Welcome Back</h1>
          <p className="auth-subtitle">
            Sign in to access your KCET & COMEDK exam profiles, probability predictions, and AI counselling.
          </p>
        </div>

        {isAuthenticated && user ? (
          <div className="card-editorial auth-authed-card">
            <div className="auth-authed-header">
              <span className="badge-editorial">✓ Signed in ({user.provider} account)</span>
              <button onClick={logoutUser} className="btn-editorial-secondary" style={{ padding: '6px 14px', fontSize: '12px' }}>
                Sign Out
              </button>
            </div>

            <div className="auth-authed-identity">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="auth-authed-avatar" />
              ) : (
                <div className="auth-authed-avatar-fallback">{user.name.charAt(0)}</div>
              )}
              <div>
                <h2 className="font-serif" style={{ fontSize: '22px', margin: 0 }}>{user.name}</h2>
                {user.email && <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '2px 0 0' }}>✉️ {user.email}</p>}
                {!user.isEmailVerified && user.email && (
                  <p style={{ color: '#D68910', fontSize: '12px', margin: '4px 0 0' }}>Email not verified yet</p>
                )}
              </div>
            </div>

            <div className="auth-authed-actions">
              <Link href="/profile" className="btn-editorial-primary">Go to My Profile</Link>
              <Link href="/predictions" className="btn-editorial-secondary">View Predictions</Link>
            </div>
          </div>
        ) : pendingTwoFactor ? (
          <div className="card-editorial auth-card">
            <span className="auth-eyebrow">Two-Factor Verification</span>
            <p className="wizard-hint" style={{ marginTop: '4px' }}>
              {pendingTwoFactor.method === 'email'
                ? 'Enter the 6-digit code we just emailed you.'
                : 'Enter the 6-digit code from your authenticator app, or a recovery code.'}
            </p>
            {loginError && <div className="auth-banner" data-tone="error">{loginError}</div>}
            <form className="auth-form" onSubmit={handleVerifyTwoFactor}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="twofa-code">Verification Code</label>
                <input
                  id="twofa-code" className="input-editorial" value={twoFactorCode} autoFocus
                  onChange={e => { setTwoFactorCode(e.target.value); clearLoginError(); }}
                  placeholder="123456" autoComplete="one-time-code" required
                />
              </div>
              <label className="auth-checkbox-row">
                <input type="checkbox" checked={trustThisDevice} onChange={e => setTrustThisDevice(e.target.checked)} />
                Remember this device for 30 days
              </label>
              <button type="submit" className="btn-editorial-primary auth-submit" disabled={isLoading} data-loading={isLoading}>
                {isLoading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
              <button type="button" className="btn-editorial-secondary" onClick={cancelTwoFactor}>
                ← Back to sign in
              </button>
            </form>
          </div>
        ) : (
          <div className="card-editorial auth-card">
            {loginError && (
              <div className="auth-banner" data-tone="error">{loginError}</div>
            )}

            <form className="auth-form" onSubmit={handleSubmit}>
              <div className="auth-field">
                <label className="auth-label" htmlFor="login-email">Email</label>
                <input
                  id="login-email"
                  type="email"
                  className="input-editorial"
                  value={email}
                  onChange={e => { setEmail(e.target.value); clearLoginError(); }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label className="auth-label" htmlFor="login-password">Password</label>
                  <Link href="/forgot-password" className="auth-link" style={{ fontSize: '12px' }}>Forgot password?</Link>
                </div>
                <PasswordField
                  id="login-password"
                  value={password}
                  onChange={v => { setPassword(v); clearLoginError(); }}
                  autoComplete="current-password"
                />
              </div>

              <label className="auth-checkbox-row">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                Remember me on this device
              </label>

              <button type="submit" className="btn-editorial-primary auth-submit" disabled={isLoading} data-loading={isLoading}>
                {isLoading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>

            <div className="auth-divider">or continue with</div>

            <OAuthButtons onGoogleCredential={handleGoogleCredential} disabled={isLoading} label="Continue with" />

            <p className="auth-footer-note">
              Don&apos;t have an account? <Link href="/register" className="auth-link">Create one</Link>
            </p>

            <p className="auth-footer-note">
              Dedicated Admin Portal? <Link href="/login/admin" className="auth-link">Login as Admin</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
