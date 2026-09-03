import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SecurityActorType } from './two-factor-auth.model';

export type TrustedDeviceDocument = TrustedDevice & Document;

/**
 * Persists device identity across logins/logouts — unlike the ephemeral
 * per-session refresh-token entries (User.sessions / AdminUser.sessions),
 * a device record survives after its session ends so "first login",
 * "rename", and "trust" all mean something even when nothing is currently
 * logged in from that device.
 */
@Schema({ timestamps: true })
export class TrustedDevice {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, enum: ['student', 'admin'] }) actorType: SecurityActorType;
  @Prop({ required: true }) deviceId: string; // fingerprint hash of UA + IP octet-family
  @Prop() deviceName?: string; // user-editable label
  @Prop() browser?: string;
  @Prop() os?: string;
  @Prop() ip?: string;
  @Prop() userAgentRaw?: string;
  @Prop({ type: Date, default: Date.now }) firstSeenAt: Date;
  @Prop({ type: Date, default: Date.now }) lastSeenAt: Date;
  @Prop({ default: false }) isTrusted: boolean;
}

export const TrustedDeviceSchema = SchemaFactory.createForClass(TrustedDevice);
TrustedDeviceSchema.index({ userId: 1, actorType: 1, deviceId: 1 }, { unique: true });
