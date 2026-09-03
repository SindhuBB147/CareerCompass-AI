// Security-module event names + payloads, emitted via EventEmitter2 by
// AuthService (and anything else outside this module) and consumed by
// SecurityEventListenerService here. Mirrors the one-directional pattern
// documented in modules/notifications/events/notification.events.ts:
// AuthModule never imports SecurityModule, it only emits — this file is a
// plain constants/interfaces module, safe to import from anywhere.

export const SECURITY_EVENTS = {
  LOGIN_ATTEMPT: 'security.login_attempt',
} as const;

export interface LoginAttemptEvent {
  userId: string;
  actorType: 'student' | 'admin';
  ip?: string;
  userAgent?: string;
  loginMethod: string;
  status: 'success' | 'failed' | 'blocked';
  failureReason?: string;
}
