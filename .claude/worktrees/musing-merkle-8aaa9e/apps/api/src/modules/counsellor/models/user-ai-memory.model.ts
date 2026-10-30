import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserAiMemoryDocument = UserAiMemory & Document;

class MemorySlots {
  @Prop() discipline?: string;
  @Prop() city?: string;
  @Prop() examCode?: string;
  @Prop() category?: string;
  @Prop() budgetMax?: number;
  @Prop() collegeType?: string;
  @Prop({ default: false }) hostelRequired: boolean;
  @Prop({ default: false }) placementFocus: boolean;
  @Prop({ default: false }) scholarshipFocus: boolean;
  @Prop({ default: false }) roiFocus: boolean;
}

/**
 * Cross-session structured "what has this student told the AI Counsellor"
 * memory — distinct from AiConversation (raw per-session transcript) and
 * User.preferences (explicit onboarding answers). One doc per user; each
 * turn's extracted entities only overwrite the slots actually mentioned in
 * that turn, so older facts survive until a newer mention replaces them.
 * See services/conversation-memory.service.ts for how slots are populated.
 */
@Schema({ timestamps: true })
export class UserAiMemory {
  @Prop({ required: true, unique: true }) userId: string;
  @Prop({ type: MemorySlots, default: () => ({}) }) slots: MemorySlots;
  @Prop() lastSourceSessionId?: string;
  @Prop({ type: Date, default: () => new Date() }) lastUpdatedAt: Date;
}

export const UserAiMemorySchema = SchemaFactory.createForClass(UserAiMemory);
