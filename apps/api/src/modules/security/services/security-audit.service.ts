import { Injectable } from '@nestjs/common';
import { SecurityEventRepository, SecurityEventFilters } from '../repositories/security-event.repository';
import { SecurityEventAction } from '../models/security-event.model';
import { SecurityActorType } from '../models/two-factor-auth.model';

export interface RecordSecurityEventInput {
  actorId: string;
  actorType: SecurityActorType | 'system';
  actorEmail?: string;
  action: SecurityEventAction;
  resourceType?: string;
  resourceId?: string;
  result?: 'success' | 'failure';
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SecurityAuditService {
  constructor(private readonly repo: SecurityEventRepository) {}

  record(input: RecordSecurityEventInput) {
    return this.repo.record({
      actorId: input.actorId,
      actorType: input.actorType,
      actorEmail: input.actorEmail,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      result: input.result ?? 'success',
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: input.metadata ?? null,
    } as any);
  }

  list(filters: SecurityEventFilters, page = 1, limit = 50) {
    return this.repo.list(filters, page, limit);
  }

  recentForUser(actorId: string, limit = 10) {
    return this.repo.recentForUser(actorId, limit);
  }
}
