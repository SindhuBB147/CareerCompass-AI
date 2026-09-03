'use client';

import { OAUTH_PROVIDER_META } from './OAuthIcons';
import type { OAuthProvider } from '../../contexts/UserAuthContext';

const PROVIDERS: OAuthProvider[] = ['google', 'microsoft', 'github', 'apple', 'linkedin'];

export function OAuthButtons({
  onSelect,
  disabled,
  label = 'Continue with',
}: {
  onSelect: (provider: OAuthProvider) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div className="oauth-grid">
      {PROVIDERS.map(provider => {
        const meta = OAUTH_PROVIDER_META[provider];
        const Icon = meta.icon;
        return (
          <button
            key={provider}
            type="button"
            onClick={() => onSelect(provider)}
            disabled={disabled}
            className="oauth-btn"
            aria-label={`${label} ${meta.label}`}
          >
            <Icon />
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
