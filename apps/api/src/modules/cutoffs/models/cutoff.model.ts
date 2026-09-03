import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CutoffDocument = Cutoff & Document;
export type CutoffConflictDocument = CutoffConflict & Document;

@Schema({ timestamps: true })
export class Cutoff {
  @Prop({ required: true }) collegeId: string;
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) examCode: string;
  @Prop({ required: true }) year: number;
  @Prop({ type: MongooseSchema.Types.Mixed, required: true }) round: number | string;
  @Prop({ required: true }) category: string;
  @Prop() openingRank?: number;
  @Prop({ required: true }) closingRank: number;
  @Prop() seatsAvailable?: number;
  @Prop({ enum: ['official', 'manual_admin_entry'], default: 'manual_admin_entry' }) source: string;
  @Prop({ type: String, default: null }) verifiedBy: string | null;

  // Common Cutoff Data Model extension fields
  @Prop({ type: String, default: null }) counsellingAuthority?: string | null;
  @Prop({ type: String, default: null }) collegeCode?: string | null;
  @Prop({ type: String, default: null }) collegeName?: string | null;
  @Prop({ type: String, default: null }) courseCode?: string | null;
  @Prop({ type: String, default: null }) courseName?: string | null;
  @Prop({ type: String, default: null }) quota?: string | null;
  @Prop({ type: String, default: null }) state?: string | null;
  @Prop({ type: String, default: null }) collegeType?: string | null;
}

export const CutoffSchema = SchemaFactory.createForClass(Cutoff);
CutoffSchema.index({ collegeId: 1, courseId: 1, examCode: 1, category: 1, year: -1, round: 1 }, { unique: true });
CutoffSchema.index({ examCode: 1, year: 1, round: 1 });
CutoffSchema.index({ examCode: 1, collegeCode: 1, courseCode: 1, category: 1 });


@Schema({ timestamps: true })
export class CutoffConflict {
  @Prop({ required: true }) collegeId: string;
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) examCode: string;
  @Prop({ required: true }) year: number;
  @Prop({ required: true }) round: number;
  @Prop({ required: true }) category: string;
  @Prop({ required: true }) field: string;
  @Prop({ required: true }) existingValue: number;
  @Prop({ required: true }) incomingValue: number;
  @Prop({ enum: ['open', 'resolved'], default: 'open' }) status: string;
  @Prop({ type: Number, default: null }) resolvedValue: number | null;
  @Prop({ type: String, default: null }) resolvedBy: string | null;
}

export const CutoffConflictSchema = SchemaFactory.createForClass(CutoffConflict);
CutoffConflictSchema.index({ status: 1 });
CutoffConflictSchema.index({ collegeId: 1, courseId: 1 });
