import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpTokenDocument = OtpToken & Document;

/** Student-facing OTP codes (password reset today). Attempts are capped
 * server-side — a 6-digit code only has 10^6 combinations, so unlike the
 * 64-char hex reset token used for admins, this needs its own brute-force
 * counter rather than relying on the code's own entropy. */
@Schema({ timestamps: true })
export class OtpToken {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true, enum: ['password_reset', '2fa_login', '2fa_setup'] }) purpose: string;
  @Prop({ required: true }) codeHash: string;
  @Prop({ required: true }) expiresAt: Date;
  @Prop({ default: false }) used: boolean;
  @Prop({ default: 0 }) attempts: number;
}

export const OtpTokenSchema = SchemaFactory.createForClass(OtpToken);
OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpTokenSchema.index({ userId: 1, purpose: 1 });
