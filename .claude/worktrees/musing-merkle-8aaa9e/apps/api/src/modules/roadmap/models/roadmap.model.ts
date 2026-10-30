import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  DIFFICULTIES, MILESTONE_CATEGORIES, MILESTONE_STATUSES, PHASE_KEYS, PRIORITIES,
} from '../roadmap.types';
import {
  CertificationRefSchema, ProjectRefSchema, ResourceRefSchema,
} from './shared-refs';

export type RoadmapDocument = Roadmap & Document;

class MilestoneInstanceSchema {
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

  // ── Progress tracking (the part the template doesn't have) ──────────
  @Prop({ enum: MILESTONE_STATUSES, default: 'not_started' }) status: string;
  @Prop({ type: Date, default: null }) startedAt: Date | null;
  @Prop({ type: Date, default: null }) completedAt: Date | null;
  @Prop({ default: '' }) notes: string;
  @Prop({ default: false }) autoCompletedFromProfile: boolean;
  @Prop({ default: false }) reminderSet: boolean;
}

class PhaseInstanceSchema {
  @Prop({ enum: PHASE_KEYS, required: true }) phaseKey: string;
  @Prop({ required: true }) label: string;
  @Prop({ required: true }) order: number;
  @Prop({ type: [MilestoneInstanceSchema], default: [] }) milestones: MilestoneInstanceSchema[];
}

class Achievement {
  @Prop({ required: true }) key: string;
  @Prop({ required: true }) label: string;
  @Prop({ type: Date, default: Date.now }) earnedAt: Date;
}

class RoadmapAnalytics {
  @Prop({ default: 0 }) completionPercent: number;
  @Prop({ default: 0 }) completedCount: number;
  @Prop({ default: 0 }) totalCount: number;
  @Prop({ default: 0 }) inProgressCount: number;
  @Prop({ default: 0 }) upcomingCount: number;
  @Prop({ default: 0 }) missedCount: number;
  @Prop({ default: 0 }) learningHoursLogged: number;
  @Prop({ default: 0 }) skillScore: number;
  @Prop({ type: [Achievement], default: [] }) achievements: Achievement[];
}

class ProfileSnapshot {
  @Prop() currentSemester?: number;
  @Prop() branch?: string;
  @Prop({ type: [String], default: [] }) knownSkills: string[];
  @Prop({ type: [String], default: [] }) knownLanguages: string[];
  @Prop() budgetMax?: number;
  @Prop() postGraduationPlan?: string;
  @Prop() careerGoal?: string;
}

@Schema({ timestamps: true })
export class Roadmap {
  @Prop({ required: true }) userId: string;
  @Prop({ required: true }) careerId: string;
  @Prop({ required: true }) careerName: string;
  @Prop({ default: true }) isActive: boolean;
  @Prop({ type: Date, default: Date.now }) generatedAt: Date;
  @Prop({ type: ProfileSnapshot, default: () => ({}) }) profileSnapshot: ProfileSnapshot;
  @Prop({ type: [PhaseInstanceSchema], default: [] }) phases: PhaseInstanceSchema[];
  @Prop({ type: RoadmapAnalytics, default: () => ({}) }) analytics: RoadmapAnalytics;
  @Prop({ type: String, default: null }) shareToken: string | null;
  @Prop({ default: false }) shareEnabled: boolean;
}

export const RoadmapSchema = SchemaFactory.createForClass(Roadmap);
RoadmapSchema.index({ userId: 1, careerId: 1 }, { unique: true });
RoadmapSchema.index({ userId: 1, isActive: 1 });
RoadmapSchema.index({ shareToken: 1 }, { sparse: true });
