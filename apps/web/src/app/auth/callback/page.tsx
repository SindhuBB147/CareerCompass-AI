'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import type { OAuthProvider } from '../../../contexts/UserAuthContext';

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loginWithOAuth, loginError } = useUserAuth();

  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const provider = (searchParams.get('provider') as OAuthProvider) || 'google';
    const name = searchParams.get('name') || undefined;
    const email = searchParams.get('email') || undefined;

    const processOAuth = async () => {
      const profile = await loginWithOAuth(provider, { name, email });
      if (profile) {
        setStatus('success');
        setTimeout(() => {
          router.push(profile.onboardingCompleted ? '/profile' : '/onboarding');
        }, 1200);
      } else {
        setStatus('error');
        setErrorMessage(loginError || 'OAuth authentication failed. Please try again.');
      }
    };

    processOAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '32px' }}>
      <div className="glass-panel" style={{ padding: '40px', borderRadius: '16px', maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        {status === 'processing' && (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Completing OAuth Sign In...</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
              Verifying credentials and provisioning your student account.
            </p>
          </div>
        )}

        {status === 'success' && (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>🎉</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#10B981' }}>OAuth Authenticated!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
              Redirecting you now...
            </p>
          </div>
        )}

        {status === 'error' && (
          <div>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#EF4444' }}>Authentication Error</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
              {errorMessage}
            </p>
            <button
              onClick={() => router.push('/login/student')}
              className="btn-primary"
              style={{ marginTop: '20px', width: '100%' }}
            >
              Back to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', color: 'var(--text-muted)' }}>
          Loading OAuth context...
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
