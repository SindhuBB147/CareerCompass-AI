import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WITH_ID_JSON } from '../../../common/utils/schema.util';

export type NotificationDocument = Notification & Document;

// Broad taxonomy — kept generic (type + subtype) rather than one enum value
// per exam/event combination, so KCET/COMEDK/NEET or new college/scholarship
// events don't require a schema change; `relatedExamCode`/`relatedCollegeId`/
// `relatedScholarshipId` carry the specific entity, `subtype` the specific
// milestone (e.g. 'choice_filling_open', 'nirf_rank_changed').
export const NOTIFICATION_TYPES = [
  'admission_event', 'scholarship_new_match', 'scholarship_deadline', 'roadmap_milestone', 'roadmap_digest',
  'college_update', 'ai_suggestion', 'account_activity', 'financial_alert', 'admin_alert', 'reminder', 'announcement',
  // Legacy values from the original skeleton — kept valid so existing rows/writers don't break.
  'deadline_reminder', 'scholarship_expiry', 'cutoff_update', 'general',
] as const;
export type NotificationType = typeof NOTIFICATION_TYPES[number];

export const NOTIFICATION_CATEGORIES = [
  'admissions', 'scholarships', 'roadmap', 'financial', 'ai_suggestions', 'account', 'system', 'announcements',
] as const;
export type NotificationCategory = typeof NOTIFICATION_CATEGORIES[number];

export const NOTIFICATION_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type NotificationPriority = typeof NOTIFICATION_PRIORITIES[number];

export const NOTIFICATION_CHANNELS = ['inApp', 'email', 'browser', 'sms', 'whatsapp', 'push'] as const;
export type NotificationChannel = typeof NOTIFICATION_CHANNELS[number];

@Schema({ timestamps: true, ...WITH_ID_JSON })
export class Notification {
  @Prop({ required: true }) userId: string;
  @Prop({ enum: NOTIFICATION_TYPES, required: true }) type: string;
  @Prop() subtype?: string;
  @Prop({ enum: NOTIFICATION_CATEGORIES, required: true, default: 'system' }) category: string;
  @Prop({ enum: NOTIFICATION_PRIORITIES, default: 'medium' }) priority: string;

  @Prop() relatedExamCode?: string;
  @Prop() relatedCollegeId?: string;
  @Prop() relatedScholarshipId?: string;
  @Prop() relatedRoadmapId?: string;

  @Prop({ required: true }) title: string;
  @Prop({ required: true }) message: string;
  @Prop() actionUrl?: string;
  @Prop() icon?: string;
  @Prop({ type: Object, default: {} }) metadata: Record<string, unknown>;

  @Prop({ type: [String], required: true }) channels: string[];
  // Delivery pipeline status — distinct from read state (see isRead below),
  // which is a per-user UI concern, not a delivery outcome.
  @Prop({ enum: ['pending', 'sent', 'failed', 'read'], default: 'pending' }) status: string;
  @Prop() scheduledFor?: Date;
  @Prop() sentAt?: Date;

  @Prop({ default: false }) isRead: boolean;
  @Prop() readAt?: Date;
  @Prop({ default: false }) isArchived: boolean;
  @Prop({ default: false }) isFavorite: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ userId: 1, status: 1 });
NotificationSchema.index({ userId: 1, isRead: 1, isArchived: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, category: 1 });
NotificationSchema.index({ scheduledFor: 1 });
NotificationSchema.index({ title: 'text', message: 'text' });
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15552000 }); // TTL 180 days
