// Typed client for the Security Module — student-facing endpoints under
// /security/*, following the apiClient wrapper pattern from admin-api.ts.

import { apiClient } from './api-client';

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export interface SecurityDashboard {
  securityScore: number;
  lastLoginAt: string | null;
  lastPasswordChangeAt: string | null;
  linkedAccounts: Array<{ provider: string; email?: string; linkedAt: string }>;
  trustedDevicesCount: number;
  totalDevicesCount: number;
  activeSessionsCount: number;
  twoFactor: { isEnabled: boolean; method: 'totp' | 'email' | null; recoveryCodesRemaining: number };
  recentEvents: Array<{ action: string; result: 'success' | 'failure'; timestamp: string; ip?: string }>;
  suspiciousLoginAlerts: Array<{ message: string; severity: 'medium' | 'high' }>;
}

export interface TrustedDevice {
  deviceId: string; deviceName?: string; browser?: string; os?: string; ip?: string;
  firstSeenAt: string; lastSeenAt: string; isTrusted: boolean;
}

export interface LoginHistoryEntry {
  _id: string; id: string; timestamp: string; ip?: string; browser?: string; os?: string;
  deviceName?: string; loginMethod: string; status: 'success' | 'failed' | 'blocked';
  failureReason?: string; reportedAsUnknown: boolean;
}

export interface SessionView {
  sessionId: string; browser: string; os: string; ip?: string;
  createdAt: string; lastUsedAt: string; isCurrent: boolean;
}

export const securityApi = {
  dashboard: (token: string | null) => apiClient.get<SecurityDashboard>('/security/dashboard', token),

  checkPasswordStrength: (password: string, token: string | null) =>
    apiClient.post<{ level: string; score: number }>('/security/password/strength', { password }, token),

  // — 2FA —
  twoFactorStatus: (token: string | null) =>
    apiClient.get<{ isEnabled: boolean; method: string | null; enabledAt: string | null; recoveryCodesRemaining: number }>('/security/2fa/status', token),
  setupTwoFactor: (method: 'totp' | 'email', token: string | null) =>
    apiClient.post<{ method: string; qrCodeDataUrl?: string; manualEntryKey?: string; message?: string }>('/security/2fa/setup', { method }, token),
  confirmTwoFactorSetup: (code: string, token: string | null) =>
    apiClient.post<{ enabled: boolean; recoveryCodes: string[] }>('/security/2fa/setup/confirm', { code }, token),
  disableTwoFactor: (currentPassword: string, token: string | null) =>
    apiClient.post<{ enabled: boolean }>('/security/2fa/disable', { currentPassword }, token),
  regenerateRecoveryCodes: (currentPassword: string, token: string | null) =>
    apiClient.post<{ recoveryCodes: string[] }>('/security/2fa/recovery-codes/regenerate', { currentPassword }, token),

  // — Devices —
  listDevices: (token: string | null) => apiClient.get<TrustedDevice[]>('/security/devices', token),
  renameDevice: (deviceId: string, deviceName: string, token: string | null) =>
    apiClient.patch<TrustedDevice>(`/security/devices/${deviceId}`, { deviceName }, token),
  trustDevice: (deviceId: string, isTrusted: boolean, token: string | null) =>
    apiClient.patch<TrustedDevice>(`/security/devices/${deviceId}/trust`, { isTrusted }, token),
  removeDevice: (deviceId: string, token: string | null) =>
    apiClient.del<{ removed: boolean }>(`/security/devices/${deviceId}`, token),

  // — Login history —
  loginHistory: (params: { page?: number; limit?: number }, token: string | null) =>
    apiClient.get<{ entries: LoginHistoryEntry[]; totalResults: number }>(`/security/login-history${buildQuery(params)}`, token),
  reportUnknownLogin: (id: string, token: string | null) =>
    apiClient.post<{ reported: boolean }>(`/security/login-history/${id}/report-unknown`, {}, token),

  // — Sessions (unified) —
  listSessions: (token: string | null) => apiClient.get<SessionView[]>('/security/sessions', token),
  revokeSession: (sessionId: string, token: string | null) =>
    apiClient.del<{ revoked: boolean }>(`/security/sessions/${sessionId}`, token),
  revokeAllSessions: (token: string | null) =>
    apiClient.post<{ revoked: boolean }>('/security/sessions/revoke-all', {}, token),

  // — Linked accounts —
  unlinkAccount: (provider: string, token: string | null) =>
    apiClient.del<{ unlinked: boolean }>(`/security/linked-accounts/${provider}`, token),
};
