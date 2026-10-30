'use client';

import React, { useEffect, useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { consentApi } from '../../lib/consent-api';
import {
  CookieConsentValue, acceptAllValue, rejectOptionalValue, getConsentCookie, setConsentCookie, CONSENT_POLICY_VERSION,
} from '../../lib/cookie-consent';

type OptionalCategory = 'functional' | 'analytics' | 'preference' | 'aiPersonalization';

const CATEGORY_COPY: Record<OptionalCategory, { label: string; description: string }> = {
  functional: { label: 'Functional', description: 'Remembers theme, language, and where you left off.' },
  analytics: { label: 'Analytics', description: 'Anonymized usage patterns that help us improve the platform.' },
  preference: { label: 'Preference', description: 'Personalizes recommendations from your saved preferences.' },
  aiPersonalization: { label: 'AI Personalization', description: 'Lets the AI Counsellor remember context across your conversations.' },
};

export function CookieConsentBanner() {
  const { accessToken, isAuthenticated } = useUserAuth();
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<Record<OptionalCategory, boolean>>({
    functional: false, analytics: false, preference: false, aiPersonalization: false,
  });

  useEffect(() => {
    const existing = getConsentCookie();
    if (!existing || existing.policyVersion !== CONSENT_POLICY_VERSION) setVisible(true);
  }, []);

  const apply = (value: CookieConsentValue, action: 'accept_all' | 'reject_optional' | 'customize') => {
    setConsentCookie(value);
    setVisible(false);
    setCustomizing(false);
    if (isAuthenticated) {
      consentApi.update({ action, ...value }, accessToken).catch(() => {
        // Non-fatal — the cookie is already the local source of truth; the
        // next authenticated page load retries the sync via getConsent().
      });
    }
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1000,
        display: 'flex', justifyContent: 'center', padding: '16px',
      }}
    >
      <div className="card-editorial" style={{ maxWidth: '760px', width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: '0 -8px 32px rgba(0,0,0,0.12)' }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>We use cookies to remember your preferences</p>
          <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
            Necessary cookies keep you signed in and secure. Everything else — theme, language, AI conversation
            memory, personalized recommendations — is optional and off until you say yes. You can change this
            anytime from Memory &amp; Privacy in your profile settings.
          </p>
        </div>

        {customizing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
            {(Object.keys(CATEGORY_COPY) as OptionalCategory[]).map(key => (
              <label key={key} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ marginTop: '3px' }}
                />
                <span>
                  <strong style={{ color: 'var(--text-primary)' }}>{CATEGORY_COPY[key].label}</strong>
                  <br />
                  <span style={{ color: 'var(--text-secondary)' }}>{CATEGORY_COPY[key].description}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-end' }}>
          {customizing ? (
            <button
              type="button"
              className="btn-editorial-primary"
              onClick={() => apply({ necessary: true, policyVersion: CONSENT_POLICY_VERSION, ...draft }, 'customize')}
            >
              Save preferences
            </button>
          ) : (
            <>
              <button type="button" className="btn-editorial-secondary" onClick={() => setCustomizing(true)}>
                Customize
              </button>
              <button type="button" className="btn-editorial-secondary" onClick={() => apply(rejectOptionalValue(), 'reject_optional')}>
                Reject optional
              </button>
              <button type="button" className="btn-editorial-primary" onClick={() => apply(acceptAllValue(), 'accept_all')}>
                Accept all
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
