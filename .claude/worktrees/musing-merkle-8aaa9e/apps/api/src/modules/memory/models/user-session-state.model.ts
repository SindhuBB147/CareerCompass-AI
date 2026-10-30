import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserSessionStateDocument = UserSessionState & Document;

/**
 * "Continue where you left off" state — one doc per user, upserted on
 * every patch. Deliberately generic (Object-typed bags keyed by whatever
 * the frontend page needs) rather than one schema field per module's filter
 * shape, since each page's filter/sort/pagination shape is that page's own
 * concern; this just needs to round-trip it.
 */
@Schema({ timestamps: true })
export class UserSessionState {
  @Prop({ required: true, unique: true }) userId: string;
  @Prop() lastDashboard?: string;
  @Prop({ type: Object, default: {} }) openFilters: Record<string, unknown>;
  @Prop({ type: Object, default: {} }) sortPreferences: Record<string, unknown>;
  @Prop({ type: Object, default: {} }) paginationState: Record<string, unknown>;
  @Prop() theme?: string;
  @Prop() language?: string;
  @Prop() lastAiSessionId?: string;
}

export const UserSessionStateSchema = SchemaFactory.createForClass(UserSessionState);
