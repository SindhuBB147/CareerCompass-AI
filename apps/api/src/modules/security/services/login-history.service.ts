import { Injectable } from '@nestjs/common';
import { LoginHistoryRepository } from '../repositories/login-history.repository';
import { parseUserAgent } from '../utils/crypto.util';
import { SecurityActorType } from '../models/two-factor-auth.model';
import { LoginStatus } from '../models/login-history.model';

export interface RecordLoginAttemptInput {
  userId: string; actorType: SecurityActorType; ip?: string; userAgent?: string;
  loginMethod: string; status: LoginStatus; failureReason?: string; deviceName?: string;
}

@Injectable()
export class LoginHistoryService {
  constructor(private readonly repo: LoginHistoryRepository) {}

  record(input: RecordLoginAttemptInput) {
    const { browser, os } = parseUserAgent(input.userAgent);
    return this.repo.record({
      userId: input.userId,
      actorType: input.actorType,
      ip: input.ip,
      userAgent: input.userAgent,
      browser,
      os,
      deviceName: input.deviceName,
      loginMethod: input.loginMethod,
      status: input.status,
      failureReason: input.failureReason,
    } as any);
  }

  list(userId: string, actorType: SecurityActorType, page = 1, limit = 20) {
    return this.repo.listForUser(userId, actorType, page, limit);
  }

  async reportUnknown(userId: string, entryId: string) {
    const entry = await this.repo.findById(entryId);
    if (!entry || entry.userId !== userId) return null;
    return this.repo.reportUnknown(entryId);
  }

  recentFailureCount(userId: string, actorType: SecurityActorType, windowMs: number) {
    return this.repo.countRecentFailures(userId, actorType, windowMs);
  }
}
