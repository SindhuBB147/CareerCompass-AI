import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GeneratedReportDocument = GeneratedReport & Document;

export const REPORT_TYPES = [
  'admission_prediction', 'financial_planning', 'scholarship_eligibility', 'student_progress',
] as const;
export type ReportType = typeof REPORT_TYPES[number];

export const REPORT_FORMATS = ['pdf', 'xlsx', 'csv', 'html'] as const;
export type ReportFormat = typeof REPORT_FORMATS[number];

@Schema({ timestamps: true })
export class GeneratedReport {
  @Prop({ required: true, index: true }) userId: string;
  @Prop({ required: true, enum: REPORT_TYPES }) reportType: ReportType;
  @Prop({ required: true, enum: REPORT_FORMATS }) format: ReportFormat;
  @Prop({ required: true }) storageKey: string;
  @Prop({ required: true }) sizeBytes: number;
  @Prop({ type: Object, default: null }) params: Record<string, unknown> | null;
  @Prop({ default: 0 }) downloadCount: number;
  @Prop({ type: String, default: null }) shareToken: string | null;
  @Prop({ default: false }) shareEnabled: boolean;
  @Prop({ type: Date, default: null }) shareExpiresAt: Date | null;
  @Prop({ required: true, default: () => new Date() }) generatedAt: Date;
}

export const GeneratedReportSchema = SchemaFactory.createForClass(GeneratedReport);
GeneratedReportSchema.index({ userId: 1, generatedAt: -1 });
GeneratedReportSchema.index({ shareToken: 1 }, { sparse: true });
GeneratedReportSchema.index({ shareExpiresAt: 1 }, { expireAfterSeconds: 0 });
