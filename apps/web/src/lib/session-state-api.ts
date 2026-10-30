// Typed client for "continue where you left off" session-state — mirrors
// lib/notifications-api.ts's conventions on the shared apiClient.

import { apiClient } from './api-client';

export interface SessionState {
  lastDashboard?: string;
  openFilters?: Record<string, unknown>;
  sortPreferences?: Record<string, unknown>;
  paginationState?: Record<string, unknown>;
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  lastAiSessionId?: string;
}

export const sessionStateApi = {
  get: (token: string | null) => apiClient.get<SessionState | null>('/session-state', token),
  patch: (patch: Partial<SessionState>, token: string | null) => apiClient.patch<SessionState>('/session-state', patch, token),
};
