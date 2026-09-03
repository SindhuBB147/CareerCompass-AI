import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SecurityActorType } from './two-factor-auth.model';

export type LoginHistoryDocument = LoginHistory & Document;
export type LoginStatus = 'success' | 'failed' | 'blocked';

/** Append-only login attempt log — every attempt, success or failure. */
@Schema({ timestamps: true })
export class LoginHistory {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, enum: ['student', 'admin'] }) actorType: SecurityActorType;
  @Prop({ required: true, default: () => new Date() }) timestamp: Date;
  @Prop() ip?: string;
  @Prop() userAgent?: string;
  @Prop() browser?: string;
  @Prop() os?: string;
  @Prop() deviceName?: string;
  @Prop({ required: true }) loginMethod: string; // password | google | microsoft | ... | otp | 2fa_totp | 2fa_email
  @Prop({ required: true, enum: ['success', 'failed', 'blocked'] }) status: LoginStatus;
  @Prop() failureReason?: string;
  // Future-ready: no geo-IP provider is configured today, so this stays
  // null rather than silently sending IPs to a third-party lookup service.
  @Prop({ type: String, default: null }) location: string | null;
  @Prop({ default: false }) reportedAsUnknown: boolean;
}

export const LoginHistorySchema = SchemaFactory.createForClass(LoginHistory);
LoginHistorySchema.index({ userId: 1, actorType: 1, timestamp: -1 });
LoginHistorySchema.index({ status: 1, timestamp: -1 });
