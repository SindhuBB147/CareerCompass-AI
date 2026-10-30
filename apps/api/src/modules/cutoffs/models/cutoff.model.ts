import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CutoffDocument = Cutoff & Document;
export type CutoffConflictDocument = CutoffConflict & Document;
export type CutoffImportLogDocument = CutoffImportLog & Document;

@Schema({ timestamps: true })
export class Cutoff {
  @Prop({ required: true }) collegeId: string;
  @Prop({ required: true }) courseId: string;
  @Prop() courseName?: string;
  @Prop({ required: true }) examCode: string;
  @Prop({ required: true }) year: number;
  @Prop({ required: true }) round: number;
  @Prop({ required: true }) category: string;
  @Prop() branch?: string;
  @Prop({ required: true }) closingRank: number;
  @Prop({ enum: ['official', 'manual_admin_entry', 'import'], default: 'official' }) source: string;
  @Prop({ type: String, default: null }) verifiedBy: string | null;
  @Prop({ enum: ['verified', 'needs_review', 'imported', 'archived', 'invalid'], default: 'imported' }) status: string;
  @Prop({ type: MongooseSchema.Types.Mixed, default: {} }) metadata?: Record<string, any>;
  @Prop({ type: Date, default: Date.now }) lastUpdated: Date;
}

export const CutoffSchema = SchemaFactory.createForClass(Cutoff);
CutoffSchema.index({ collegeId: 1, courseId: 1, examCode: 1, category: 1, year: -1, round: 1 }, { unique: true });
CutoffSchema.index({ collegeId: 1, examCode: 1, year: -1 });
CutoffSchema.index({ examCode: 1, year: 1, round: 1 });
CutoffSchema.index({ category: 1 });
CutoffSchema.index({ status: 1 });

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

@Schema({ timestamps: true })
export class CutoffImportLog {
  @Prop({ required: true, unique: true }) importId: string;
  @Prop({ required: true }) fileName: string;
  @Prop({ required: true }) totalRows: number;
  @Prop({ required: true, default: 0 }) insertedCount: number;
  @Prop({ required: true, default: 0 }) updatedCount: number;
  @Prop({ required: true, default: 0 }) failedCount: number;
  @Prop({ type: [String], default: [] }) errorLog: string[];
  @Prop({ enum: ['completed', 'failed', 'rolled_back'], default: 'completed' }) status: string;
  @Prop({ required: true }) uploadedBy: string;
  @Prop({ type: [String], default: [] }) affectedCutoffIds: string[];
}

export const CutoffImportLogSchema = SchemaFactory.createForClass(CutoffImportLog);
CutoffImportLogSchema.index({ createdAt: -1 });
