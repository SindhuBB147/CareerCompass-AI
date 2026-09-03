// Typed client for cookie/DPDP-style consent — mirrors lib/notifications-api.ts's
// conventions on the shared apiClient. Used by both the CookieConsentBanner
// (pre-login default is unauthenticated — the banner writes the cc_consent
// cookie directly and only calls this once a token exists) and the Memory &
// Privacy page.

import { apiClient } from './api-client';

export interface ConsentState {
  necessary: boolean;
  functional: boolean;
  analytics: boolean;
  preference: boolean;
  aiPersonalization: boolean;
  policyVersion: string;
}

export type ConsentAction = 'accept_all' | 'reject_optional' | 'customize';

export interface UpdateConsentInput {
  action: ConsentAction;
  functional?: boolean;
  analytics?: boolean;
  preference?: boolean;
  aiPersonalization?: boolean;
}

export const consentApi = {
  get: (token: string | null) => apiClient.get<ConsentState>('/consent', token),
  update: (input: UpdateConsentInput, token: string | null) => apiClient.patch<ConsentState>('/consent', input, token),
  withdraw: (token: string | null) => apiClient.post<ConsentState>('/consent/withdraw', undefined, token),
};
