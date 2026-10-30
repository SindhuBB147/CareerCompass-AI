import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ExamDocument = Exam & Document;

class ExamRound {
  @Prop({ required: true }) roundNumber: number;
  @Prop() name?: string;
  @Prop() choiceFillingStart?: Date;
  @Prop() choiceFillingEnd?: Date;
  @Prop() cutoffReleaseDate?: Date;
  @Prop() reportingDeadline?: Date;
  @Prop({ enum: ['upcoming', 'active', 'closed'], default: 'upcoming' }) status: string;
}

@Schema({ timestamps: true })
export class Exam {
  @Prop({ required: true }) code: string;
  @Prop({ required: true }) name: string;
  @Prop() conductingBody?: string;
  @Prop({ type: [String], default: ['Karnataka'] }) applicableStates: string[];
  @Prop({ required: true }) year: number;
  @Prop({ type: [ExamRound], default: [] }) rounds: ExamRound[];
  @Prop({ default: true }) isActive: boolean;
}

export const ExamSchema = SchemaFactory.createForClass(Exam);
ExamSchema.index({ code: 1, year: 1 }, { unique: true });
ExamSchema.index({ 'rounds.choiceFillingEnd': 1 });
ExamSchema.index({ isActive: 1 });
