import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConsentRecord, ConsentRecordDocument, CONSENT_POLICY_VERSION } from '../models/consent-record.model';
import { UpdateConsentDto } from '../dto/memory.dto';

export interface ConsentRequestMeta {
  ip?: string;
  userAgent?: string;
}

const HISTORY_CAP = 50;

/**
 * Cookie/DPDP-style consent — the banner (pre-login, via the cc_consent
 * cookie) and this service (post-login, authoritative) both express the
 * same five categories. `necessary` can never be turned off; every write
 * appends a capped audit entry (who/when/what changed) rather than
 * overwriting silently, matching the "Consent Logging" requirement.
 */
@Injectable()
export class ConsentService {
  constructor(
    @InjectModel(ConsentRecord.name) private readonly model: Model<ConsentRecordDocument>,
  ) {}

  async getConsent(userId: string): Promise<ConsentRecordDocument> {
    const existing = await this.model.findOne({ userId }).exec();
    if (existing) return existing;
    return this.model.create({ userId });
  }

  async updateConsent(userId: string, dto: UpdateConsentDto, meta: ConsentRequestMeta = {}): Promise<ConsentRecordDocument> {
    const categories = this.resolveCategories(dto);
    return this.applyChange(userId, dto.action, categories, meta);
  }

  async withdraw(userId: string, meta: ConsentRequestMeta = {}): Promise<ConsentRecordDocument> {
    const categories = { functional: false, analytics: false, preference: false, aiPersonalization: false };
    return this.applyChange(userId, 'withdraw', categories, meta);
  }

  private resolveCategories(dto: UpdateConsentDto): Record<string, boolean> {
    if (dto.action === 'accept_all') return { functional: true, analytics: true, preference: true, aiPersonalization: true };
    if (dto.action === 'reject_optional') return { functional: false, analytics: false, preference: false, aiPersonalization: false };
    // customize — only the categories explicitly present in the request change.
    const categories: Record<string, boolean> = {};
    if (dto.functional !== undefined) categories.functional = dto.functional;
    if (dto.analytics !== undefined) categories.analytics = dto.analytics;
    if (dto.preference !== undefined) categories.preference = dto.preference;
    if (dto.aiPersonalization !== undefined) categories.aiPersonalization = dto.aiPersonalization;
    return categories;
  }

  private async applyChange(userId: string, action: string, categories: Record<string, boolean>, meta: ConsentRequestMeta): Promise<ConsentRecordDocument> {
    const set: Record<string, unknown> = { necessary: true, policyVersion: CONSENT_POLICY_VERSION, ...categories };
    const historyEntry = { action, categories: { necessary: true, ...categories }, ip: meta.ip, userAgent: meta.userAgent, timestamp: new Date() };

    return this.model.findOneAndUpdate(
      { userId },
      { $set: set, $push: { history: { $each: [historyEntry], $slice: -HISTORY_CAP } } },
      { upsert: true, new: true },
    ).exec();
  }
}
