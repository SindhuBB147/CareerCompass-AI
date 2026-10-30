'use client';

import { GoogleSignInButton } from './GoogleSignInButton';
import { OAUTH_PROVIDER_META } from './OAuthIcons';
import type { OAuthProvider } from '../../contexts/UserAuthContext';

// Only Google has a real, verified sign-in flow (see google-oauth.service.ts
// on the backend). The rest used to go through a client-trusted mock — that
// was an auth-bypass hole, not a working feature — so until each one gets a
// real provider integration, they render disabled rather than functional.
const COMING_SOON_PROVIDERS: OAuthProvider[] = ['microsoft', 'github', 'apple', 'linkedin'];

export function OAuthButtons({
  onGoogleCredential,
  disabled,
  label = 'Continue with',
}: {
  onGoogleCredential: (idToken: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="oauth-grid">
      <GoogleSignInButton onCredential={onGoogleCredential} disabled={disabled} />
      {COMING_SOON_PROVIDERS.map(provider => {
        const meta = OAUTH_PROVIDER_META[provider];
        const Icon = meta.icon;
        return (
          <button
            key={provider}
            type="button"
            disabled
            className="oauth-btn"
            aria-label={`${label} ${meta.label} — coming soon`}
            title="Coming soon"
          >
            <Icon />
            <span>{meta.label}</span>
            <span className="badge-editorial reports-coming-soon" style={{ marginLeft: '6px', fontSize: '10px' }}>Soon</span>
          </button>
        );
      })}
    </div>
  );
}
