import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { TwoFactorAuthRepository } from '../repositories/two-factor-auth.repository';
import { TrustedDeviceRepository } from '../repositories/trusted-device.repository';
import { LoginHistoryRepository } from '../repositories/login-history.repository';
import { SecurityEventRepository } from '../repositories/security-event.repository';
import { PasswordPolicyService } from './password-policy.service';
import { SecurityActorType } from '../models/two-factor-auth.model';

const SUSPICIOUS_WINDOW_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SecurityDashboardService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminUserRepository,
    private readonly twoFactorRepo: TwoFactorAuthRepository,
    private readonly deviceRepo: TrustedDeviceRepository,
    private readonly loginHistoryRepo: LoginHistoryRepository,
    private readonly eventRepo: SecurityEventRepository,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  async dashboard(userId: string, actorType: SecurityActorType) {
    const doc: any = actorType === 'student' ? await this.userRepo.findById(userId) : await this.adminRepo.findById(userId);
    if (!doc) return null;

    const [twoFactor, devices, recentEvents, recentFailures] = await Promise.all([
      this.twoFactorRepo.findByUser(userId, actorType),
      this.deviceRepo.listForUser(userId, actorType),
      this.eventRepo.recentForUser(userId, 10),
      this.loginHistoryRepo.countRecentFailures(userId, actorType, SUSPICIOUS_WINDOW_MS),
    ]);

    const passwordChangedAt: Date | null = doc.passwordChangedAt ?? null;
    const twoFactorEnabled = twoFactor?.isEnabled ?? false;
    const isEmailVerified = actorType === 'student' ? !!doc.isEmailVerified : true;
    const untrustedDevices = devices.filter(d => !d.isTrusted).length;

    const score = this.computeScore({
      twoFactorEnabled,
      isEmailVerified,
      passwordExpired: this.passwordPolicy.isExpired(passwordChangedAt),
      recentFailures,
      untrustedDevices,
    });

    return {
      securityScore: score,
      lastLoginAt: doc.lastLoginAt ?? null,
      lastPasswordChangeAt: passwordChangedAt,
      linkedAccounts: actorType === 'student' ? doc.linkedAccounts ?? [] : [],
      trustedDevicesCount: devices.filter(d => d.isTrusted).length,
      totalDevicesCount: devices.length,
      activeSessionsCount: doc.sessions?.length ?? 0,
      twoFactor: {
        isEnabled: twoFactorEnabled,
        method: twoFactor?.method ?? null,
        recoveryCodesRemaining: twoFactor?.recoveryCodes.filter(c => !c.usedAt).length ?? 0,
      },
      recentEvents,
      suspiciousLoginAlerts: recentFailures > 0
        ? [{ message: `${recentFailures} failed login attempt(s) in the last 24 hours.`, severity: recentFailures >= 5 ? 'high' : 'medium' }]
        : [],
    };
  }

  private computeScore(input: {
    twoFactorEnabled: boolean; isEmailVerified: boolean; passwordExpired: boolean;
    recentFailures: number; untrustedDevices: number;
  }): number {
    let score = 40; // baseline for having an active account with a hashed password
    if (input.twoFactorEnabled) score += 30;
    if (input.isEmailVerified) score += 15;
    if (!input.passwordExpired) score += 10;
    score -= Math.min(20, input.recentFailures * 4);
    score -= Math.min(10, input.untrustedDevices * 2);
    return Math.max(0, Math.min(100, score));
  }
}
