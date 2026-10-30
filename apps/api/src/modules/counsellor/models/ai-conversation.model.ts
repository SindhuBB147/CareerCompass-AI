import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AiConversationDocument = AiConversation & Document;

class StructuredSourceRef {
  @Prop({ required: true }) type: string; // college | cutoff | scholarship | prediction | financial | roadmap | exam
  @Prop({ required: true }) id: string;
  @Prop({ required: true }) title: string;
}

class Citation {
  @Prop({ required: true }) tag: string;
  @Prop({ required: true }) sourceType: string;
  @Prop({ required: true }) sourceId: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) snippet: string;
  // Only ever set for sourceType 'document' chunks drawn from a PDF with
  // page markers — never fabricated for formats with no page concept.
  @Prop() page?: number;
  @Prop() pageRange?: string;
}

class ActionButton {
  @Prop({ required: true }) label: string;
  @Prop({ required: true }) action: string;
  @Prop({ type: Object, default: {} }) params: Record<string, string>;
}

class ChatMessage {
  @Prop({ enum: ['user', 'assistant'], required: true }) role: string;
  @Prop({ required: true }) content: string;
  @Prop({ type: [Citation], default: [] }) sourcesCited: Citation[];
  @Prop() reasoning?: string;
  @Prop() intent?: string;
  @Prop({ min: 0, max: 1 }) confidenceScore?: number;
  @Prop({ enum: ['high', 'medium', 'low'] }) confidenceLevel?: string;
  @Prop({ default: false }) lowConfidence: boolean;
  @Prop({ type: [StructuredSourceRef], default: [] }) structuredSources: StructuredSourceRef[];
  @Prop({ type: [String], default: [] }) suggestedQuestions: string[];
  @Prop({ type: [String], default: [] }) relatedColleges: string[];
  @Prop({ type: [ActionButton], default: [] }) actionButtons: ActionButton[];
  @Prop() provider?: string;
  @Prop({ required: true, default: () => new Date() }) timestamp: Date;
}

@Schema({ timestamps: true })
export class AiConversation {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true, unique: true }) sessionId: string;
  @Prop() title?: string;
  @Prop({ type: [ChatMessage], default: [] }) messages: ChatMessage[];
  @Prop({ required: true, default: () => new Date() }) startedAt: Date;
  @Prop() lastMessageAt?: Date;
  @Prop({ default: false }) flaggedForReview: boolean;
  @Prop({ enum: ['active', 'closed', 'escalated'], default: 'active' }) status: string;
}

export const AiConversationSchema = SchemaFactory.createForClass(AiConversation);
AiConversationSchema.index({ userId: 1, lastMessageAt: -1 });
AiConversationSchema.index({ flaggedForReview: 1 });
