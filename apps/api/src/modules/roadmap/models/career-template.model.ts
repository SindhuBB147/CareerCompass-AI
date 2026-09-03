import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  CAREER_CATEGORIES, CareerCategory, DIFFICULTIES, MILESTONE_CATEGORIES, PHASE_KEYS,
  PRIORITIES,
} from '../roadmap.types';
import { CertificationRefSchema, ProjectRefSchema, ResourceRefSchema } from './shared-refs';

export type CareerTemplateDocument = CareerTemplate & Document;

class MilestoneTemplateSchema {
  @Prop({ required: true }) milestoneKey: string;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) description: string;
  @Prop({ enum: MILESTONE_CATEGORIES, required: true }) category: string;
  @Prop({ required: true }) estimatedWeeks: number;
  @Prop({ enum: DIFFICULTIES, default: 'intermediate' }) difficulty: string;
  @Prop({ enum: PRIORITIES, default: 'medium' }) priority: string;
  @Prop({ type: [String], default: [] }) dependsOn: string[];
  @Prop({ type: [String], default: [] }) skills: string[];
  @Prop({ type: [ResourceRefSchema], default: [] }) resources: ResourceRefSchema[];
  @Prop({ type: [CertificationRefSchema], default: [] }) certifications: CertificationRefSchema[];
  @Prop({ type: [ProjectRefSchema], default: [] }) projects: ProjectRefSchema[];
}

class PhaseTemplateSchema {
  @Prop({ enum: PHASE_KEYS, required: true }) phaseKey: string;
  @Prop({ required: true }) label: string;
  @Prop({ required: true }) order: number;
  @Prop({ type: [MilestoneTemplateSchema], default: [] }) milestones: MilestoneTemplateSchema[];
}

@Schema({ timestamps: true })
export class CareerTemplate {
  @Prop({ required: true, unique: true }) careerId: string;
  @Prop({ required: true }) name: string;
  @Prop({ enum: CAREER_CATEGORIES, required: true }) category: CareerCategory;
  @Prop({ required: true }) description: string;
  @Prop({ type: [String], default: [] }) tags: string[];
  @Prop({ type: [PhaseTemplateSchema], default: [] }) phases: PhaseTemplateSchema[];
  @Prop({ default: true }) isActive: boolean;
}

export const CareerTemplateSchema = SchemaFactory.createForClass(CareerTemplate);
CareerTemplateSchema.index({ category: 1 });
CareerTemplateSchema.index({ tags: 1 });
