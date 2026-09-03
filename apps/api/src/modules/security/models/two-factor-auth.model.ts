import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TwoFactorAuthDocument = TwoFactorAuth & Document;
export type SecurityActorType = 'student' | 'admin';
export type TwoFactorMethod = 'totp' | 'email';

class RecoveryCode {
  @Prop({ required: true }) codeHash: string;
  @Prop({ type: Date, default: null }) usedAt: Date | null;
}

/**
 * One document per user (student or admin) who has ever set up 2FA.
 * totpSecretEncrypted is reversible (AES-256-GCM, see crypto.util.ts) rather
 * than hashed — verifying a TOTP code requires recomputing it from the raw
 * secret, unlike a password/OTP where a one-way hash is enough.
 */
@Schema({ timestamps: true })
export class TwoFactorAuth {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, enum: ['student', 'admin'] }) actorType: SecurityActorType;
  @Prop({ enum: ['totp', 'email'], default: 'totp' }) method: TwoFactorMethod;
  @Prop({ type: String, default: null }) totpSecretEncrypted: string | null;
  @Prop({ default: false }) isEnabled: boolean;
  @Prop({ type: Date, default: null }) enabledAt: Date | null;
  @Prop({ type: [RecoveryCode], default: [] }) recoveryCodes: RecoveryCode[];
  // Trusted-device-skips-2FA support: device fingerprints allowed to bypass
  // the challenge for a limited time after a successful verification.
  @Prop({ type: [String], default: [] }) trustedDeviceFingerprints: string[];
}

export const TwoFactorAuthSchema = SchemaFactory.createForClass(TwoFactorAuth);
TwoFactorAuthSchema.index({ userId: 1, actorType: 1 }, { unique: true });
