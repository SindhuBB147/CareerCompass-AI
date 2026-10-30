import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SearchHistoryDocument = SearchHistory & Document;

/**
 * One row per Smart Search query. Mirrors ai-usage-log.model.ts's shape
 * (owned by Nest, not ai-service, since it's keyed by the authenticated
 * userId). Query text is PII-masked before being written — see
 * common/utils/pii.ts — so "popular searches" aggregation stays at the
 * same privacy bar the AI Counsellor's usage log already uses.
 */
@Schema({ timestamps: true })
export class SearchHistory {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) queryMasked: string;
  @Prop() intent?: string;
  @Prop({ type: Object, default: {} }) entities: Record<string, unknown>;
  @Prop({ type: Object, default: {} }) resultCounts: Record<string, number>;
  @Prop({ type: [String], default: [] }) clickedResultIds: string[];
  @Prop({ default: false }) isSaved: boolean;
  @Prop() savedLabel?: string;
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);
SearchHistorySchema.index({ userId: 1, createdAt: -1 });
SearchHistorySchema.index({ isSaved: 1 });
