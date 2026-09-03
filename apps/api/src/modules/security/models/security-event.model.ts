import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SecurityActorType } from './two-factor-auth.model';

export type SecurityEventDocument = SecurityEvent & Document;

// Security-domain audit taxonomy. Kept separate from colleges/models/
// audit-log.model.ts's AuditLog (a data-CRUD before/after diff log already
// wired into Colleges/Cutoffs/Scholarships/Roadmap admin services) — this
// one is an event trail for auth/session/security actions instead of a
// field-level diff of a mutated document.
export const SECURITY_EVENT_ACTIONS = [
  'login', 'logout', 'password_change', 'profile_update', 'email_change', 'phone_change',
  '2fa_enabled', '2fa_disabled', 'account_recovery', 'delete_account', 'role_change',
  'device_trusted', 'device_removed', 'session_revoked', 'account_locked', 'account_unlocked',
  'account_disabled', 'linked_account_added', 'linked_account_removed', 'admin_action',
  'ai_config_change', 'knowledge_base_update', 'scholarship_update', 'prediction_update',
  'system_config_change',
  'report_generated', 'report_downloaded', 'report_shared', 'report_deleted', 'report_emailed',
] as const;
export type SecurityEventAction = typeof SECURITY_EVENT_ACTIONS[number];

@Schema({ timestamps: true })
export class SecurityEvent {
  @Prop({ required: true, index: true }) actorId: string;
  @Prop({ required: true, enum: ['student', 'admin', 'system'] }) actorType: SecurityActorType | 'system';
  @Prop() actorEmail?: string;
  @Prop({ required: true, index: true }) action: SecurityEventAction;
  @Prop() resourceType?: string;
  @Prop() resourceId?: string;
  @Prop({ required: true, enum: ['success', 'failure'], default: 'success' }) result: 'success' | 'failure';
  @Prop() ip?: string;
  @Prop() userAgent?: string;
  @Prop({ type: Object, default: null }) metadata: Record<string, unknown> | null;
  @Prop({ required: true, default: () => new Date() }) timestamp: Date;
}

export const SecurityEventSchema = SchemaFactory.createForClass(SecurityEvent);
SecurityEventSchema.index({ actorId: 1, timestamp: -1 });
SecurityEventSchema.index({ action: 1, timestamp: -1 });
