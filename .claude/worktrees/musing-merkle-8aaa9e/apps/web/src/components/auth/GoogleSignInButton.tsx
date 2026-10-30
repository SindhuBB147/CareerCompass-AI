'use client';

import { useEffect, useRef } from 'react';
import { GoogleIcon } from './OAuthIcons';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let gsiScriptPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;
  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services.'));
    document.head.appendChild(script);
  });
  return gsiScriptPromise;
}

/**
 * Renders Google's own "Sign in with Google" button via Identity Services —
 * the ID token it hands back is verified server-side (see
 * google-oauth.service.ts on the backend), so this component never
 * fabricates or forwards a client-asserted identity.
 */
export function GoogleSignInButton({
  onCredential,
  disabled,
}: {
  onCredential: (idToken: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || disabled || !containerRef.current) return;
    let cancelled = false;

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: response => onCredential(response.credential),
        });
        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'outline', size: 'large', shape: 'rectangular', width: 240, text: 'continue_with',
        });
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [clientId, disabled, onCredential]);

  if (!clientId) {
    return (
      <button type="button" disabled className="oauth-btn" aria-label="Google sign-in unavailable" title="Google sign-in is not configured">
        <GoogleIcon />
        <span>Google (unavailable)</span>
      </button>
    );
  }

  return <div ref={containerRef} style={{ display: disabled ? 'none' : 'block' }} />;
}
