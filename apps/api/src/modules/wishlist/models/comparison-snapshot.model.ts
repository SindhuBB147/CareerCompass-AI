import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ComparisonSnapshotDocument = ComparisonSnapshot & Document;

// One row per "Compare" action from the wishlist — powers Comparison
// History for the student and "Most Compared Colleges" for admins.
@Schema({ timestamps: true })
export class ComparisonSnapshot {
  @Prop({ required: true }) userId: string;
  @Prop({ type: [String], required: true }) collegeIds: string[];
  @Prop() name?: string;
}

export const ComparisonSnapshotSchema = SchemaFactory.createForClass(ComparisonSnapshot);
ComparisonSnapshotSchema.index({ userId: 1, createdAt: -1 });
ComparisonSnapshotSchema.index({ collegeIds: 1 });
