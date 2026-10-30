import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScholarshipInteractionDocument = ScholarshipInteraction & Document;

export const SCHOLARSHIP_INTERACTION_ACTIONS = ['viewed', 'applied', 'rejected', 'eligibility_checked'] as const;
export type ScholarshipInteractionAction = typeof SCHOLARSHIP_INTERACTION_ACTIONS[number];

/**
 * Scholarship Memory beyond "saved" — ScholarshipBookmark already owns
 * saved/bookmarked scholarships; this covers the rest (viewed, applied,
 * self-reported rejected, and eligibility-check outcomes), append-only so
 * the same scholarship can accumulate a history rather than one row per
 * student+scholarship. There's no full application-tracking workflow in the
 * platform, so "applied"/"rejected" are student self-reported, not verified
 * against an external application system.
 */
@Schema({ timestamps: true })
export class ScholarshipInteraction {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) scholarshipId: string;
  @Prop({ type: String, enum: SCHOLARSHIP_INTERACTION_ACTIONS, required: true }) action: ScholarshipInteractionAction;
  @Prop({ type: Object, default: {} }) metadata: Record<string, unknown>;
}

export const ScholarshipInteractionSchema = SchemaFactory.createForClass(ScholarshipInteraction);
ScholarshipInteractionSchema.index({ userId: 1, createdAt: -1 });
ScholarshipInteractionSchema.index({ userId: 1, scholarshipId: 1, action: 1 });
