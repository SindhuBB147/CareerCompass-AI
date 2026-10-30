// Client-side cookie-consent storage. The cc_consent cookie is the
// pre-login source of truth (the banner has to work before a token
// exists) and is kept as a fast local cache post-login too; ConsentContext
// syncs it to the backend (see lib/consent-api.ts) once authenticated,
// which becomes authoritative for that user's account thereafter.
// Non-sensitive by design: category booleans + a policy version only —
// never a token, never PII — so Secure + SameSite=Lax is enough, no
// HttpOnly (the banner's own JS has to read it).

export const CONSENT_COOKIE_NAME = 'cc_consent';
export const CONSENT_POLICY_VERSION = '1.0';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export interface CookieConsentValue {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  preference: boolean;
  aiPersonalization: boolean;
  policyVersion: string;
}

export function getConsentCookie(): CookieConsentValue | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

export function setConsentCookie(value: CookieConsentValue): void {
  if (typeof document === 'undefined') return;
  const secure = typeof location !== 'undefined' && location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(value))}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

export function acceptAllValue(): CookieConsentValue {
  return { necessary: true, functional: true, analytics: true, preference: true, aiPersonalization: true, policyVersion: CONSENT_POLICY_VERSION };
}

export function rejectOptionalValue(): CookieConsentValue {
  return { necessary: true, functional: false, analytics: false, preference: false, aiPersonalization: false, policyVersion: CONSENT_POLICY_VERSION };
}
