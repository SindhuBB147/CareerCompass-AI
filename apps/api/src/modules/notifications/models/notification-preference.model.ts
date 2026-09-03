import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { NOTIFICATION_CATEGORIES } from './notification.model';
import { WITH_ID_JSON } from '../../../common/utils/schema.util';

export type NotificationPreferenceDocument = NotificationPreference & Document;

// Master per-channel switches. `email`/`inApp` default on; `browser` needs
// explicit opt-in (Notification API permission prompt); `sms`/`whatsapp`/`push`
// mirror the legacy per-user `User.notificationChannels` defaults but live
// here going forward — this is the channel matrix the new dispatch pipeline
// actually reads.
class ChannelPreferences {
  @Prop({ default: true }) inApp: boolean;
  @Prop({ default: true }) email: boolean;
  @Prop({ default: false }) browser: boolean;
  @Prop({ default: false }) sms: boolean;
  @Prop({ default: false }) whatsapp: boolean;
  @Prop({ default: false }) push: boolean;
}

// Per-category master switch — a category disabled here suppresses that
// category's notifications on every channel, regardless of ChannelPreferences.
class CategoryPreferences {
  @Prop({ default: true }) admissions: boolean;
  @Prop({ default: true }) scholarships: boolean;
  @Prop({ default: true }) roadmap: boolean;
  @Prop({ default: true }) financial: boolean;
  @Prop({ default: true }) ai_suggestions: boolean;
  @Prop({ default: true }) account: boolean;
  @Prop({ default: true }) system: boolean;
  @Prop({ default: true }) announcements: boolean;
}

@Schema({ timestamps: true, ...WITH_ID_JSON })
export class NotificationPreference {
  @Prop({ required: true, unique: true }) userId: string;
  @Prop({ type: ChannelPreferences, default: () => ({}) }) channels: ChannelPreferences;
  @Prop({ type: CategoryPreferences, default: () => ({}) }) categories: CategoryPreferences;
  @Prop({ default: true }) weeklySummary: boolean;
  @Prop({ default: false }) marketingEmails: boolean;
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);

export { NOTIFICATION_CATEGORIES };
