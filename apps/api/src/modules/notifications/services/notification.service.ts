import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Notification, NotificationDocument } from '../models/notification.model';
import { UserRepository } from '../../users/repositories/user.repository';
import { DomainException } from '../../../common/filters/domain.exception';
import { HttpStatus } from '@nestjs/common';

export interface NotificationPayload {
  userId: string;
  type: string;
  title: string;
  message: string;
  channels: string[];
  subtype?: string;
  category?: string;
  priority?: string;
  actionUrl?: string;
  icon?: string;
  metadata?: Record<string, unknown>;
  relatedExamCode?: string;
  relatedCollegeId?: string;
  relatedScholarshipId?: string;
  relatedRoadmapId?: string;
  scheduledFor?: Date;
}

export interface ListNotificationsFilters {
  status?: string;
  type?: string;
  category?: string;
  priority?: string;
  isRead?: boolean;
  isArchived?: boolean;
  isFavorite?: boolean;
  search?: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger('NotificationService');

  constructor(
    @InjectModel(Notification.name) private readonly model: Model<NotificationDocument>,
    private readonly userRepo: UserRepository,
  ) {}

  /** List notifications for a student, most recent first, with the full Notification Center filter set. */
  async listForUser(
    userId: string,
    filters: ListNotificationsFilters = {},
    page = 1,
    limit = 20,
  ): Promise<{ notifications: NotificationDocument[]; total: number }> {
    const query: FilterQuery<NotificationDocument> = { userId, isArchived: filters.isArchived ?? false };
    if (filters.status) query.status = filters.status;
    if (filters.type) query.type = filters.type;
    if (filters.category) query.category = filters.category;
    if (filters.priority) query.priority = filters.priority;
    if (filters.isRead !== undefined) query.isRead = filters.isRead;
    if (filters.isFavorite !== undefined) query.isFavorite = filters.isFavorite;
    if (filters.isArchived !== undefined) query.isArchived = filters.isArchived;
    if (filters.search) query.$text = { $search: filters.search };

    const [notifications, total] = await Promise.all([
      this.model.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);
    return { notifications, total };
  }

  async unreadCount(userId: string): Promise<number> {
    return this.model.countDocuments({ userId, isRead: false, isArchived: false }).exec();
  }

  /** Mark a notification as read — only the owning student can do this. */
  async markRead(userId: string, notificationId: string): Promise<NotificationDocument> {
    const notif = await this.model.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true, readAt: new Date() },
      { new: true },
    ).exec();
    if (!notif) throw new DomainException('NOT_FOUND', 'Notification not found.', HttpStatus.NOT_FOUND);
    return notif;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await this.model.updateMany(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    ).exec();
    return result.modifiedCount ?? 0;
  }

  async setArchived(userId: string, notificationId: string, isArchived: boolean): Promise<NotificationDocument> {
    const notif = await this.model.findOneAndUpdate(
      { _id: notificationId, userId },
      { isArchived },
      { new: true },
    ).exec();
    if (!notif) throw new DomainException('NOT_FOUND', 'Notification not found.', HttpStatus.NOT_FOUND);
    return notif;
  }

  async setFavorite(userId: string, notificationId: string, isFavorite: boolean): Promise<NotificationDocument> {
    const notif = await this.model.findOneAndUpdate(
      { _id: notificationId, userId },
      { isFavorite },
      { new: true },
    ).exec();
    if (!notif) throw new DomainException('NOT_FOUND', 'Notification not found.', HttpStatus.NOT_FOUND);
    return notif;
  }

  async remove(userId: string, notificationId: string): Promise<void> {
    const result = await this.model.deleteOne({ _id: notificationId, userId }).exec();
    if (result.deletedCount === 0) throw new DomainException('NOT_FOUND', 'Notification not found.', HttpStatus.NOT_FOUND);
  }

  /** Schedule/persist a single notification for delivery. */
  async schedule(payload: NotificationPayload): Promise<NotificationDocument> {
    return this.model.create({
      ...payload,
      category: payload.category ?? 'system',
      priority: payload.priority ?? 'medium',
      status: payload.scheduledFor ? 'pending' : 'sent',
      sentAt: payload.scheduledFor ? undefined : new Date(),
    });
  }

  /**
   * Fan-out: generates deadline reminder notifications for all students
   * enrolled in a specific exam. Called by a scheduled job (cron) or
   * triggered when an admin updates the exam round calendar.
   */
  async generateDeadlineAlerts(examCode: string, roundNumber: number, deadlineDate: Date, deadlineLabel: string): Promise<number> {
    const users = await this.userRepo.findByExamCode(examCode);
    let sent = 0;

    for (const user of users) {
      const enabledChannels: string[] = [];
      if (user.notificationChannels?.sms) enabledChannels.push('sms');
      if (user.notificationChannels?.email && user.isEmailVerified) enabledChannels.push('email');
      if (user.notificationChannels?.whatsapp) enabledChannels.push('whatsapp');
      if (user.notificationChannels?.push) enabledChannels.push('push');
      enabledChannels.push('inApp');

      await this.schedule({
        userId: user.id,
        type: 'deadline_reminder',
        category: 'admissions',
        title: `${examCode} ${deadlineLabel}`,
        message: `${deadlineLabel} for ${examCode} Round ${roundNumber} is on ${deadlineDate.toLocaleDateString('en-IN')}. Don't miss it.`,
        channels: enabledChannels,
        relatedExamCode: examCode,
        scheduledFor: new Date(deadlineDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
      });
      sent++;
    }

    this.logger.log(`Generated ${sent} deadline alerts for ${examCode} Round ${roundNumber}`);
    return sent;
  }

  /** B2B nudge: a coaching institute account manager sends a targeted notification. */
  async sendNudge(userId: string, message: string, channels: string[]): Promise<NotificationDocument> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new DomainException('NOT_FOUND', 'Student not found.', HttpStatus.NOT_FOUND);

    return this.schedule({
      userId,
      type: 'general',
      category: 'announcements',
      title: 'Message from your counsellor',
      message,
      channels,
    });
  }
}
