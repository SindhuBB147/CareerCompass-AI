import { Injectable } from '@nestjs/common';
import { UserRepository } from '../../users/repositories/user.repository';
import { AdminUserRepository } from '../../auth/repositories/admin-user.repository';
import { parseUserAgent } from '../utils/crypto.util';
import { SecurityActorType } from '../models/two-factor-auth.model';

export interface SessionView {
  sessionId: string; userAgent?: string; browser: string; os: string;
  ip?: string; createdAt: Date; lastUsedAt: Date; isCurrent: boolean;
}

/** Thin unified view over User.sessions / AdminUser.sessions — both are now
 * the same shape (see AdminUser's new `sessions[]`), so this just picks the
 * right repository and enriches with parsed browser/OS for display. */
@Injectable()
export class SessionService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly adminRepo: AdminUserRepository,
  ) {}

  async list(userId: string, actorType: SecurityActorType, currentSessionId?: string): Promise<SessionView[]> {
    const doc = actorType === 'student' ? await this.userRepo.findById(userId) : await this.adminRepo.findById(userId);
    if (!doc) return [];
    return (doc as any).sessions.map((s: any) => {
      const { browser, os } = parseUserAgent(s.userAgent);
      return {
        sessionId: s.sessionId, userAgent: s.userAgent, browser, os, ip: s.ip,
        createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, isCurrent: s.sessionId === currentSessionId,
      };
    });
  }

  revoke(userId: string, actorType: SecurityActorType, sessionId: string) {
    return actorType === 'student' ? this.userRepo.revokeSession(userId, sessionId) : this.adminRepo.revokeSession(userId, sessionId);
  }

  revokeOthers(userId: string, actorType: SecurityActorType, keepSessionId: string) {
    return actorType === 'student'
      ? this.userRepo.revokeOtherSessions(userId, keepSessionId)
      : this.adminRepo.revokeOtherSessions(userId, keepSessionId);
  }

  revokeAll(userId: string, actorType: SecurityActorType) {
    return actorType === 'student' ? this.userRepo.revokeAllSessions(userId) : this.adminRepo.revokeAllSessions(userId);
  }
}
