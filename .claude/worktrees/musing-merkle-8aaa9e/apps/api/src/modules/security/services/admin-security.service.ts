import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { LoginHistoryRepository } from '../repositories/login-history.repository';
import { SecurityEventRepository } from '../repositories/security-event.repository';
import { SessionService } from './session.service';
import { SecurityActorType } from '../models/two-factor-auth.model';
import { AdminService } from '../../admin/services/admin.service';

@Injectable()
export class AdminSecurityService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminUserRepository,
    private readonly loginHistoryRepo: LoginHistoryRepository,
    private readonly eventRepo: SecurityEventRepository,
    private readonly sessionService: SessionService,
    private readonly adminService: AdminService,
  ) {}

  failedLogins(page = 1, limit = 50) {
    return this.loginHistoryRepo.listRecentByStatus('failed', page, limit);
  }

  suspiciousLogins(page = 1, limit = 50) {
    return this.loginHistoryRepo.listSuspicious(page, limit);
  }

  async lockedAccounts(page = 1, limit = 50) {
    const [students, admins] = await Promise.all([
      this.userRepo.findLocked(page, limit),
      this.adminRepo.findLocked(page, limit),
    ]);
    return {
      students: students.users, studentTotal: students.totalResults,
      admins: admins.admins, adminTotal: admins.totalResults,
    };
  }

  async activeSessions(page = 1, limit = 50) {
    const [students, admins] = await Promise.all([
      this.userRepo.listActiveSessions(page, limit),
      this.adminRepo.listActiveSessions(page, limit),
    ]);
    return {
      students: students.rows, studentTotal: students.totalResults,
      admins: admins.rows, adminTotal: admins.totalResults,
    };
  }

  forceLogout(userId: string, actorType: SecurityActorType) {
    return this.sessionService.revokeAll(userId, actorType);
  }

  unlock(userId: string, actorType: SecurityActorType) {
    return actorType === 'student' ? this.userRepo.setLockedUntil(userId, null) : this.adminRepo.setLockedUntil(userId, null);
  }

  /** Reuses the existing AdminService mutations (updateUserStatus /
   * updateAdmin) rather than duplicating status-change logic here. */
  disable(userId: string, actorType: SecurityActorType, actingAdminId: string, ip: string | undefined, reason: string) {
    return actorType === 'student'
      ? this.adminService.updateUserStatus(userId, 'suspended', reason)
      : this.adminService.updateAdmin(userId, { isActive: false }, actingAdminId, ip);
  }

  securityEvents(page = 1, limit = 50) {
    return this.eventRepo.list({}, page, limit);
  }

  async analytics(days = 30) {
    const [trends, browsers, os] = await Promise.all([
      this.loginHistoryRepo.loginTrends(days),
      this.loginHistoryRepo.distributionBy('browser', days),
      this.loginHistoryRepo.distributionBy('os', days),
    ]);
    return { loginTrends: trends, browserDistribution: browsers, osDistribution: os };
  }
}
