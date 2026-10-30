import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SECURITY_EVENTS, LoginAttemptEvent } from '../events/security.events';
import { LoginHistoryService } from './login-history.service';
import { DeviceService } from './device.service';
import { SecurityAuditService } from './security-audit.service';

/** Turns AuthService's login-attempt events into LoginHistory rows, device
 * upserts, and SecurityEvent audit records — kept out of AuthService itself
 * so AuthModule never has to depend on SecurityModule (see
 * modules/security/events/security.events.ts header). */
@Injectable()
export class SecurityEventListenerService {
  constructor(
    private readonly loginHistory: LoginHistoryService,
    private readonly devices: DeviceService,
    private readonly audit: SecurityAuditService,
  ) {}

  @OnEvent(SECURITY_EVENTS.LOGIN_ATTEMPT)
  async onLoginAttempt(event: LoginAttemptEvent) {
    let deviceName: string | undefined;
    if (event.status === 'success') {
      const device = await this.devices.recordLogin({
        userId: event.userId, actorType: event.actorType, ip: event.ip, userAgent: event.userAgent,
      });
      deviceName = device.deviceName;
    }

    await this.loginHistory.record({
      userId: event.userId, actorType: event.actorType, ip: event.ip, userAgent: event.userAgent,
      loginMethod: event.loginMethod, status: event.status, failureReason: event.failureReason, deviceName,
    });

    await this.audit.record({
      actorId: event.userId, actorType: event.actorType, action: 'login',
      result: event.status === 'success' ? 'success' : 'failure',
      ip: event.ip, userAgent: event.userAgent,
      metadata: { loginMethod: event.loginMethod, failureReason: event.failureReason },
    });
  }
}
