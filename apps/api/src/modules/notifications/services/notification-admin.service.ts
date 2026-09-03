import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { NotificationDispatchService } from './notification-dispatch.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { NotificationTemplate, NotificationTemplateDocument } from '../models/notification-template.model';
import { NotificationDeliveryLog, NotificationDeliveryLogDocument } from '../models/notification-delivery-log.model';
import { AuditLog, AuditLogDocument } from '../../colleges/models/audit-log.model';
import { EMAIL_TEMPLATE_DEFAULTS } from '../../../common/mailer/email-templates';
import { DomainException } from '../../../common/filters/domain.exception';

export interface BroadcastInput {
  title: string;
  message: string;
  category?: string;
  priority?: string;
  actionUrl?: string;
}

const BROADCAST_PAGE_SIZE = 500;

/**
 * Admin-only notification operations: broadcast/targeted send, announcements,
 * template management, and the delivery-status view. Kept separate from
 * NotificationDispatchService (the per-user fan-out primitive it calls into)
 * so the student-facing dispatch path stays free of admin/audit concerns.
 */
@Injectable()
export class NotificationAdminService {
  private readonly logger = new Logger('NotificationAdminService');

  constructor(
    private readonly dispatch: NotificationDispatchService,
    private readonly userRepo: UserRepository,
    @InjectModel(NotificationTemplate.name) private readonly templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(NotificationDeliveryLog.name) private readonly logModel: Model<NotificationDeliveryLogDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  /** Sends to every active student, batched so memory stays bounded regardless of user-base size. */
  async broadcast(adminId: string, input: BroadcastInput): Promise<number> {
    let page = 1;
    let sent = 0;
    for (;;) {
      const batch = await this.userRepo.findActivePage(page, BROADCAST_PAGE_SIZE);
      if (batch.length === 0) break;
      await Promise.all(batch.map(u => this.dispatch.dispatch({
        userId: u.id,
        type: 'announcement',
        category: input.category ?? 'announcements',
        priority: input.priority ?? 'medium',
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
      })));
      sent += batch.length;
      if (batch.length < BROADCAST_PAGE_SIZE) break;
      page++;
    }
    await this.audit(adminId, 'broadcast', { title: input.title, recipients: sent });
    return sent;
  }

  async targetedSend(adminId: string, userIds: string[], input: BroadcastInput): Promise<number> {
    let sent = 0;
    for (const userId of userIds) {
      const result = await this.dispatch.dispatch({
        userId,
        type: 'announcement',
        category: input.category ?? 'announcements',
        priority: input.priority ?? 'medium',
        title: input.title,
        message: input.message,
        actionUrl: input.actionUrl,
      });
      if (result) sent++;
    }
    await this.audit(adminId, 'targeted_send', { title: input.title, recipients: sent, userIds });
    return sent;
  }

  async createAnnouncement(adminId: string, input: BroadcastInput): Promise<number> {
    return this.broadcast(adminId, { ...input, category: 'announcements' });
  }

  // ── Templates ──────────────────────────────────────────────────────────

  async listTemplates(): Promise<Array<{ key: string; name: string; subject: string; htmlBody: string; category?: string; isActive: boolean; isOverridden: boolean }>> {
    const overrides = await this.templateModel.find().exec();
    const overrideMap = new Map(overrides.map(o => [o.key, o]));
    return EMAIL_TEMPLATE_DEFAULTS.map(def => {
      const override = overrideMap.get(def.key);
      return override
        ? { key: override.key, name: override.name, subject: override.subject, htmlBody: override.htmlBody, category: override.category, isActive: override.isActive, isOverridden: true }
        : { key: def.key, name: def.name, subject: def.subject, htmlBody: def.htmlBody, category: def.category, isActive: true, isOverridden: false };
    });
  }

  async upsertTemplate(adminId: string, key: string, patch: { name?: string; subject?: string; htmlBody?: string; category?: string; isActive?: boolean }): Promise<NotificationTemplateDocument> {
    const def = EMAIL_TEMPLATE_DEFAULTS.find(t => t.key === key);
    if (!def) throw new DomainException('NOT_FOUND', `Unknown template key "${key}".`, HttpStatus.NOT_FOUND);
    const template = await this.templateModel.findOneAndUpdate(
      { key },
      { $set: { name: patch.name ?? def.name, subject: patch.subject ?? def.subject, htmlBody: patch.htmlBody ?? def.htmlBody, category: patch.category ?? def.category, isActive: patch.isActive ?? true, availableVariables: def.availableVariables } },
      { upsert: true, new: true },
    ).exec();
    await this.audit(adminId, 'template_update', { key });
    return template;
  }

  async resetTemplate(adminId: string, key: string): Promise<void> {
    await this.templateModel.deleteOne({ key }).exec();
    await this.audit(adminId, 'template_reset', { key });
  }

  // ── Delivery status ────────────────────────────────────────────────────

  async deliveryStatus(filters: { status?: string; channel?: string }, page: number, limit: number) {
    const query: FilterQuery<NotificationDeliveryLogDocument> = {};
    if (filters.status) query.status = filters.status;
    if (filters.channel) query.channel = filters.channel;
    const [logs, total] = await Promise.all([
      this.logModel.find(query).sort({ attemptedAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.logModel.countDocuments(query).exec(),
    ]);
    return { logs, total };
  }

  private async audit(adminId: string, action: string, snapshot: Record<string, unknown>): Promise<void> {
    await this.auditModel.create({
      adminId, action, targetCollection: 'notifications', targetId: action,
      beforeSnapshot: null, afterSnapshot: snapshot, timestamp: new Date(),
    });
  }
}
