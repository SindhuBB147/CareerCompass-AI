import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { MailerService } from '../../../common/mailer/mailer.service';
import { UserRepository } from '../../users/repositories/user.repository';
import { NotificationDeliveryLog, NotificationDeliveryLogDocument } from '../models/notification-delivery-log.model';
import { Notification, NotificationDocument } from '../models/notification.model';

// Channels that have a real, working delivery path in this app today.
// sms/whatsapp/push have no provider integration (no Twilio/FCM credentials
// anywhere in this codebase) — they're recorded as "skipped (future-ready)"
// so the preference/UI plumbing is real even though nothing is sent, matching
// the spec's own "Push Notifications (future-ready)" framing.
const LIVE_CHANNELS = new Set(['inApp', 'email', 'browser']);

export interface DispatchInput {
  userId: string;
  type: string;
  category: string;
  title: string;
  message: string;
  subtype?: string;
  priority?: string;
  actionUrl?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  relatedExamCode?: string;
  relatedCollegeId?: string;
  relatedScholarshipId?: string;
  relatedRoadmapId?: string;
  /** If set, the email uses this template + variables instead of a generic title/message email. */
  emailTemplateKey?: string;
  emailVariables?: Record<string, string>;
}

/**
 * Single fan-out entry point: every trigger (event listener, scheduler,
 * admin broadcast) calls dispatch() (immediate) or scheduleFor() (deferred)
 * with what happened; this resolves the user's NotificationPreference,
 * persists the in-app record via NotificationService, sends email via
 * MailerService when enabled, and logs every channel attempt to
 * NotificationDeliveryLog for the admin delivery-status view.
 */
@Injectable()
export class NotificationDispatchService {
  private readonly logger = new Logger('NotificationDispatchService');

  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
    private readonly mailer: MailerService,
    private readonly userRepo: UserRepository,
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(NotificationDeliveryLog.name) private readonly logModel: Model<NotificationDeliveryLogDocument>,
  ) {}

  async dispatch(input: DispatchInput): Promise<NotificationDocument | null> {
    return this.persistAndMaybeDeliver(input, undefined);
  }

  /** Persists a notification now but defers delivery until `scheduledFor` — picked up by NotificationSchedulerService.deliverDueNotifications(). */
  async scheduleFor(input: DispatchInput, scheduledFor: Date): Promise<NotificationDocument | null> {
    return this.persistAndMaybeDeliver(input, scheduledFor);
  }

  private async persistAndMaybeDeliver(input: DispatchInput, scheduledFor: Date | undefined): Promise<NotificationDocument | null> {
    const user = await this.userRepo.findById(input.userId);
    if (!user || user.accountStatus !== 'active') return null;

    const pref = await this.preferenceService.getOrCreate(input.userId);
    const enabledChannels = (['inApp', 'email', 'browser', 'sms', 'whatsapp', 'push'] as const)
      .filter(ch => this.preferenceService.isChannelEnabled(pref, input.category, ch));

    if (enabledChannels.length === 0) return null; // category muted entirely

    const notification = await this.notificationService.schedule({
      userId: input.userId,
      type: input.type,
      subtype: input.subtype,
      category: input.category,
      priority: input.priority ?? 'medium',
      title: input.title,
      message: input.message,
      actionUrl: input.actionUrl,
      icon: input.icon,
      metadata: { ...input.metadata, emailTemplateKey: input.emailTemplateKey, emailVariables: input.emailVariables },
      channels: enabledChannels,
      relatedExamCode: input.relatedExamCode,
      relatedCollegeId: input.relatedCollegeId,
      relatedScholarshipId: input.relatedScholarshipId,
      relatedRoadmapId: input.relatedRoadmapId,
      scheduledFor,
    });

    if (!scheduledFor) {
      await Promise.all(enabledChannels.map(channel => this.deliverChannel(notification, user, channel, input)));
    }

    return notification;
  }

  /** Called by NotificationSchedulerService — delivers every notification whose scheduledFor has arrived. */
  async deliverDueNotifications(now = new Date()): Promise<number> {
    const due = await this.notificationModel.find({ status: 'pending', scheduledFor: { $lte: now } }).exec();
    let delivered = 0;
    for (const notification of due) {
      const user = await this.userRepo.findById(notification.userId);
      if (!user) { notification.status = 'failed'; await notification.save(); continue; }
      const meta = notification.metadata as { emailTemplateKey?: string; emailVariables?: Record<string, string> };
      await Promise.all(notification.channels.map(channel => this.deliverChannel(notification, user, channel, {
        userId: notification.userId,
        title: notification.title, message: notification.message,
        emailTemplateKey: meta?.emailTemplateKey, emailVariables: meta?.emailVariables,
      })));
      notification.status = 'sent';
      notification.sentAt = new Date();
      await notification.save();
      delivered++;
    }
    return delivered;
  }

  private async deliverChannel(
    notification: NotificationDocument,
    user: { email?: string; isEmailVerified?: boolean },
    channel: string,
    input: Pick<DispatchInput, 'userId' | 'title' | 'message' | 'emailTemplateKey' | 'emailVariables'>,
  ): Promise<void> {
    if (!LIVE_CHANNELS.has(channel)) {
      await this.log(notification.id, input.userId, channel, 'skipped', 'future-ready channel — no provider configured');
      return;
    }
    if (channel === 'inApp' || channel === 'browser') {
      // In-app is already persisted above; browser delivery happens
      // client-side (Web Notification API) off the same polled record —
      // nothing further to do server-side.
      await this.log(notification.id, input.userId, channel, 'sent');
      return;
    }
    if (channel === 'email') {
      if (!user.email || !user.isEmailVerified) {
        await this.log(notification.id, input.userId, channel, 'skipped', 'no verified email on file');
        return;
      }
      try {
        if (input.emailTemplateKey) {
          await this.mailer.sendTemplate(user.email, input.emailTemplateKey, input.emailVariables ?? {});
        } else {
          await this.mailer.deliverEmail(user.email, input.title, `<h1>${input.title}</h1><p>${input.message}</p>`);
        }
        await this.log(notification.id, input.userId, channel, 'sent');
      } catch (err) {
        this.logger.warn(`Email delivery failed for notification ${notification.id}: ${(err as Error).message}`);
        await this.log(notification.id, input.userId, channel, 'failed', (err as Error).message);
      }
    }
  }

  private async log(notificationId: string, userId: string, channel: string, status: 'sent' | 'failed' | 'skipped', error?: string): Promise<void> {
    await this.logModel.create({ notificationId, userId, channel, status, error });
  }
}
