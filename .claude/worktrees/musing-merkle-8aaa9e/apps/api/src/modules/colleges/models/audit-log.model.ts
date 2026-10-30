import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema()
export class AuditLog {
  @Prop({ required: true }) adminId: string;
  @Prop({ required: true }) action: string;
  @Prop({ required: true }) targetCollection: string;
  @Prop({ required: true }) targetId: string;
  @Prop({ type: Object, default: null }) beforeSnapshot: Record<string, unknown> | null;
  @Prop({ type: Object, default: null }) afterSnapshot: Record<string, unknown> | null;
  @Prop({ required: true, default: () => new Date() }) timestamp: Date;
  @Prop({ type: String, default: null }) ipAddress: string | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ targetCollection: 1, targetId: 1 });
AuditLogSchema.index({ adminId: 1 });
AuditLogSchema.index({ timestamp: -1 });
