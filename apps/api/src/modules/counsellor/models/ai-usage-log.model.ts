import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiUsageLogDocument = AiUsageLog & Document;

/**
 * One row per AI Counsellor request. Owned by Nest (not ai-service)
 * because it's keyed by the authenticated userId/session that only Nest
 * knows — ai-service is stateless with respect to platform auth. Query
 * text is PII-masked before being written (see common/utils/pii.ts).
 */
@Schema({ timestamps: true })
export class AiUsageLog {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) sessionId: string;
  @Prop({ required: true }) queryMasked: string;
  @Prop() intent?: string;
  @Prop() provider?: string;
  @Prop() model?: string;
  @Prop({ min: 0, max: 1 }) confidenceScore?: number;
  @Prop({ default: false }) lowConfidence: boolean;
  @Prop({ default: false }) degraded: boolean;
  @Prop({ required: true }) latencyMs: number;
  @Prop({ default: false }) errored: boolean;
}

export const AiUsageLogSchema = SchemaFactory.createForClass(AiUsageLog);
AiUsageLogSchema.index({ userId: 1, createdAt: -1 });
AiUsageLogSchema.index({ lowConfidence: 1 });
