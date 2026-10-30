import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationPreference, NotificationPreferenceDocument } from '../models/notification-preference.model';

export interface PreferencePatch {
  channels?: Partial<{ inApp: boolean; email: boolean; browser: boolean; sms: boolean; whatsapp: boolean; push: boolean }>;
  categories?: Partial<{
    admissions: boolean; scholarships: boolean; roadmap: boolean; financial: boolean;
    ai_suggestions: boolean; account: boolean; system: boolean; announcements: boolean;
  }>;
  weeklySummary?: boolean;
  marketingEmails?: boolean;
}

// Explicit defaults, mirrored 1:1 from the @Prop({default}) values on
// notification-preference.model.ts. `ChannelPreferences`/`CategoryPreferences`
// aren't standalone @Schema()-decorated classes, so Mongoose stores them as a
// Mixed field rather than a proper nested schema and never cascades their
// per-field @Prop defaults on create({ userId }) alone — passing the full
// shape here is what actually seeds it correctly.
const DEFAULT_CHANNELS = { inApp: true, email: true, browser: false, sms: false, whatsapp: false, push: false };
const DEFAULT_CATEGORIES = {
  admissions: true, scholarships: true, roadmap: true, financial: true,
  ai_suggestions: true, account: true, system: true, announcements: true,
};

@Injectable()
export class NotificationPreferenceService {
  constructor(
    @InjectModel(NotificationPreference.name) private readonly model: Model<NotificationPreferenceDocument>,
  ) {}

  /** Fetches the user's preference doc, creating one with full defaults on first access. */
  async getOrCreate(userId: string): Promise<NotificationPreferenceDocument> {
    let pref = await this.model.findOne({ userId }).exec();
    if (!pref) {
      pref = await this.model.create({
        userId, channels: { ...DEFAULT_CHANNELS }, categories: { ...DEFAULT_CATEGORIES },
        weeklySummary: true, marketingEmails: false,
      });
    }
    return pref;
  }

  async update(userId: string, patch: PreferencePatch): Promise<NotificationPreferenceDocument> {
    const pref = await this.getOrCreate(userId);
    if (patch.channels) Object.assign(pref.channels, patch.channels);
    if (patch.categories) Object.assign(pref.categories, patch.categories);
    if (patch.weeklySummary !== undefined) pref.weeklySummary = patch.weeklySummary;
    if (patch.marketingEmails !== undefined) pref.marketingEmails = patch.marketingEmails;
    pref.markModified('channels');
    pref.markModified('categories');
    await pref.save();
    return pref;
  }

  /** Whether `channel` should fire for `category` — the single gate NotificationDispatchService consults. */
  isChannelEnabled(pref: NotificationPreferenceDocument, category: string, channel: string): boolean {
    const categoryEnabled = (pref.categories as unknown as Record<string, boolean>)[category] ?? true;
    const channelEnabled = (pref.channels as unknown as Record<string, boolean>)[channel] ?? false;
    return categoryEnabled && channelEnabled;
  }
}
