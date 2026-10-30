'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { OAuthButtons } from '../../components/auth/OAuthButtons';
import { PasswordField } from '../../components/auth/PasswordField';
import { PasswordStrengthMeter } from '../../components/auth/PasswordStrengthMeter';

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle, isLoading, loginError, clearLoginError } = useUserAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [newsletterOptIn, setNewsletterOptIn] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (!acceptTerms) {
      setFormError('You must accept the Terms of Service and Privacy Policy.');
      return;
    }

    const ok = await register({ fullName, email, password, confirmPassword, acceptTerms, newsletterOptIn });
    if (ok) router.push('/onboarding');
  };

  const handleGoogleCredential = async (idToken: string) => {
    const profile = await loginWithGoogle(idToken);
    if (profile) router.push(profile.onboardingCompleted ? '/profile' : '/onboarding');
  };

  const displayError = formError || loginError;

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-header">
          <span className="auth-eyebrow">Create Your Account</span>
          <h1 className="text-section-title font-serif auth-title">Join CareerCompass AI</h1>
          <p className="auth-subtitle">
            Build your student profile and unlock personalized college predictions, scholarships, and AI-guided roadmaps.
          </p>
        </div>

        <div className="card-editorial auth-card">
          {displayError && <div className="auth-banner" data-tone="error">{displayError}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-name">Full Name</label>
              <input
                id="reg-name"
                type="text"
                className="input-editorial"
                value={fullName}
                onChange={e => { setFullName(e.target.value); setFormError(null); clearLoginError(); }}
                placeholder="Aarav Sharma"
                autoComplete="name"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                className="input-editorial"
                value={email}
                onChange={e => { setEmail(e.target.value); setFormError(null); clearLoginError(); }}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-password">Password</label>
              <PasswordField
                id="reg-password"
                value={password}
                onChange={v => { setPassword(v); setFormError(null); clearLoginError(); }}
                autoComplete="new-password"
              />
              <PasswordStrengthMeter password={password} />
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="reg-confirm">Confirm Password</label>
              <PasswordField
                id="reg-confirm"
                value={confirmPassword}
                onChange={v => { setConfirmPassword(v); setFormError(null); }}
                autoComplete="new-password"
              />
            </div>

            <label className="auth-checkbox-row">
              <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} required />
              I agree to the Terms of Service and Privacy Policy
            </label>

            <label className="auth-checkbox-row">
              <input type="checkbox" checked={newsletterOptIn} onChange={e => setNewsletterOptIn(e.target.checked)} />
              Send me scholarship deadlines and admission updates (optional)
            </label>

            <button type="submit" className="btn-editorial-primary auth-submit" disabled={isLoading} data-loading={isLoading}>
              {isLoading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <div className="auth-divider">or sign up with</div>

          <OAuthButtons onGoogleCredential={handleGoogleCredential} disabled={isLoading} label="Sign up with" />

          <p className="auth-footer-note">
            Already have an account? <Link href="/login/student" className="auth-link">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
