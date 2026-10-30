import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CutoffDocument = Cutoff & Document;
export type CutoffConflictDocument = CutoffConflict & Document;

@Schema({ timestamps: true })
export class Cutoff {
  @Prop({ required: true }) collegeId: string;
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) examCode: string;
  @Prop({ required: true }) year: number;
  @Prop({ required: true }) round: number;
  @Prop({ required: true }) category: string;
  @Prop() openingRank?: number;
  @Prop({ required: true }) closingRank: number;
  @Prop() seatsAvailable?: number;
  @Prop({ enum: ['official', 'manual_admin_entry'], default: 'manual_admin_entry' }) source: string;
  @Prop({ type: String, default: null }) verifiedBy: string | null;
}

export const CutoffSchema = SchemaFactory.createForClass(Cutoff);
CutoffSchema.index({ collegeId: 1, courseId: 1, examCode: 1, category: 1, year: -1, round: 1 }, { unique: true });
CutoffSchema.index({ examCode: 1, year: 1, round: 1 });

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
