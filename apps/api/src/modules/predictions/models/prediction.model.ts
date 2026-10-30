import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PredictionDocument = Prediction & Document;

export type ProbabilityBand = 'Safe' | 'Moderate' | 'Ambitious' | 'Reach';

class Rationale {
  @Prop({ required: true }) trendingClosingRank: number;
  @Prop({ required: true }) studentRank: number;
  @Prop({ enum: ['high', 'medium', 'low'], required: true }) confidenceLevel: string;
}

class RoiEstimate {
  @Prop({ required: true }) totalInvestment: number;
  @Prop({ required: true }) tuitionAndFees: number;
  @Prop({ required: true }) livingCost: number;
  @Prop({ required: true }) scholarshipSavings: number;
  @Prop({ required: true }) netCost: number;
  @Prop({ required: true }) projectedPackageAnnual: number;
  @Prop({ required: true }) highestPackageAnnual: number;
  @Prop() placementPercentage?: number;
  @Prop({ required: true }) paybackYears: number;
  @Prop({ required: true }) roiPercent: number;
  @Prop({ required: true }) durationYears: number;
}

class PlacementEstimate {
  @Prop({ type: [Number], required: true }) placementPercentRange: number[];
  @Prop({ type: [Number], required: true }) packageRange: number[];
}

@Schema({ timestamps: true })
export class Prediction {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) collegeId: string;
  @Prop({ required: true }) courseId: string;
  @Prop({ required: true }) examCode: string;
  // Optional: ROI-only cache documents (examCode: 'ROI', see PredictionService.getRoi)
  // populate roiEstimate but not these admission-probability fields.
  @Prop({ type: String, enum: ['Safe', 'Moderate', 'Ambitious', 'Reach'] }) probabilityBand?: ProbabilityBand;
  @Prop({ min: 0, max: 100 }) probabilityPercent?: number;
  @Prop({ type: Rationale }) rationale?: Rationale;
  @Prop({ type: RoiEstimate }) roiEstimate?: RoiEstimate;
  @Prop({ type: PlacementEstimate }) placementEstimate?: PlacementEstimate;
  @Prop() modelVersion?: string;
  @Prop({ required: true }) computedAt: Date;
  @Prop() expiresAt?: Date;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);
PredictionSchema.index({ userId: 1, collegeId: 1, courseId: 1, examCode: 1 }, { unique: true });
PredictionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PredictionSchema.index({ computedAt: -1 });
