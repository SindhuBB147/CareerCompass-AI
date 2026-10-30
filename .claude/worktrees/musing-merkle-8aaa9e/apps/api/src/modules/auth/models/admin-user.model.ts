import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AdminUserDocument = AdminUser & Document;

export type AdminRole =
  | 'super_admin'
  | 'data_manager'
  | 'support_agent'
  | 'b2b_account_manager'
  | 'counsellor'
  | 'moderator'
  | 'data_entry_operator'
  | 'content_manager'
  | 'ai_manager';

export const ADMIN_ROLES: AdminRole[] = [
  'super_admin', 'data_manager', 'support_agent', 'b2b_account_manager',
  'counsellor', 'moderator', 'data_entry_operator', 'content_manager', 'ai_manager',
];

/** One entry per refreshed device/browser for an admin — mirrors
 * User.sessions (users/models/user.model.ts) so admins get the same
 * multi-device session management students already have, instead of the
 * single currentRefreshTokenHash slot. */
class AdminSession {
  @Prop({ required: true }) sessionId: string;
  @Prop({ required: true }) refreshTokenHash: string;
  @Prop() userAgent?: string;
  @Prop() ip?: string;
  @Prop({ type: Date, default: Date.now }) createdAt: Date;
  @Prop({ type: Date, default: Date.now }) lastUsedAt: Date;
}

@Schema({ timestamps: true })
export class AdminUser {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: String, required: true, enum: ADMIN_ROLES })
  role: AdminRole;

  @Prop({ type: [String], default: [] })
  permissions: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  // Deprecated in favor of `sessions[]` below — left in the schema so
  // documents written before the multi-session switch don't break, but no
  // longer read or written by AuthService. Any refresh token issued before
  // this field was retired requires one fresh login.
  @Prop({ type: String, default: null })
  currentRefreshTokenHash: string | null;

  @Prop({ type: [AdminSession], default: [] })
  sessions: AdminSession[];

  // — Security module additions (mirrors User's equivalents) —
  @Prop({ type: Date, default: null }) passwordChangedAt: Date | null;
  @Prop({ type: [String], default: [] }) passwordHistory: string[];
  @Prop({ type: Date, default: null }) lockedUntil: Date | null;
  @Prop({ default: 0 }) failedLoginCount: number;
  @Prop({ default: false }) twoFactorEnabled: boolean;
  @Prop({ type: String, default: null }) twoFactorMethod: string | null;
  @Prop({ type: [String], default: [] }) twoFactorTrustedDeviceFingerprints: string[];
}

export const AdminUserSchema = SchemaFactory.createForClass(AdminUser);
AdminUserSchema.index({ 'sessions.sessionId': 1 });
