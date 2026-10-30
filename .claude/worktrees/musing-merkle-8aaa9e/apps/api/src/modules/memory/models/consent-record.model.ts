import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ConsentRecordDocument = ConsentRecord & Document;

export const CONSENT_POLICY_VERSION = '1.0';

class ConsentHistoryEntry {
  @Prop({ enum: ['accept_all', 'reject_optional', 'customize', 'withdraw'], required: true }) action: string;
  @Prop({ type: Object, required: true }) categories: Record<string, boolean>;
  @Prop() ip?: string;
  @Prop() userAgent?: string;
  @Prop({ type: Date, default: () => new Date() }) timestamp: Date;
}

/**
 * Cookie/DPDP-style consent, one doc per user. `necessary` is always true
 * (essential cookies — auth, security — can't be opted out of, matching the
 * spec's "Necessary Cookies" category). `history` is a capped audit trail
 * (last 50 changes) for DPDP/GDPR-style consent logging — see
 * ConsentService for the $slice cap, same capped-array pattern
 * User.passwordHistory already uses.
 */
@Schema({ timestamps: true })
export class ConsentRecord {
  @Prop({ required: true, unique: true }) userId: string;
  @Prop({ default: true }) necessary: boolean;
  @Prop({ default: false }) functional: boolean;
  @Prop({ default: false }) analytics: boolean;
  @Prop({ default: false }) preference: boolean;
  @Prop({ default: false }) aiPersonalization: boolean;
  @Prop({ default: CONSENT_POLICY_VERSION }) policyVersion: string;
  @Prop({ type: [ConsentHistoryEntry], default: [] }) history: ConsentHistoryEntry[];
}

export const ConsentRecordSchema = SchemaFactory.createForClass(ConsentRecord);
