import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ScholarshipDocument = Scholarship & Document;

/**
 * Karnataka KEA reservation codes (GM/SC/ST/2A/2B/3A/3B/Cat-1/EWS) and the
 * legacy General/OBC/SC/ST/EWS/Other labels are BOTH accepted in
 * `categories` — the same dual-taxonomy tradeoff the seed data already
 * used, kept so existing matches (predictor's countMatchingForProfile,
 * counsellor's getMatched) keep working unchanged.
 */
class Eligibility {
  @Prop({ type: [String], default: [] }) categories: string[];
  @Prop() maxIncome?: number;
  @Prop() minIncome?: number;
  @Prop({ type: [String], default: ['Karnataka'] }) states: string[];
  @Prop({ type: [String], default: [] }) exams: string[];
  // Free-text course/degree labels (e.g. "MBBS", "B.E./B.Tech", "Diploma")
  // — deliberately not FK'd to Course documents; scholarships are awarded
  // across far more program types than the college catalog models.
  @Prop({ type: [String], default: [] }) applicableCourses: string[];
  @Prop() genderSpecific?: string;
  @Prop({ default: false }) minorityOnly: boolean;
  @Prop({ default: false }) pwdOnly: boolean;
  @Prop({ type: [String], default: [] }) requiredReservations: string[]; // e.g. ['PwD', 'Rural', 'Kannada Medium']
  @Prop() minRank?: number;
  @Prop() maxRank?: number;
  @Prop() minAcademicPercent?: number;
  @Prop() academicCriteriaNote?: string;
}

class AwardAmount {
  @Prop({ enum: ['fixed', 'percentage'], required: true }) type: string;
  @Prop({ required: true }) value: number;
  @Prop() displayText?: string; // e.g. "Up to ₹50,000/year" for irregular award structures
}

class ApplicationStep {
  @Prop({ required: true }) stepNumber: number;
  @Prop({ required: true }) title: string;
  @Prop({ required: true }) description: string;
}

class Faq {
  @Prop({ required: true }) question: string;
  @Prop({ required: true }) answer: string;
}

class ApplicationLinks {
  @Prop() officialWebsite?: string;
  @Prop() applyLink?: string;
  @Prop() notificationPdf?: string;
  @Prop() guidelinesPdf?: string;
  @Prop() helpdeskUrl?: string;
}

class ContactInfo {
  @Prop() email?: string;
  @Prop() phone?: string;
}

@Schema({ timestamps: true })
export class Scholarship {
  @Prop({ required: true }) name: string;
  @Prop({ unique: true, sparse: true }) slug?: string;

  // Broad grouping (used by analytics/matching) — kept exactly as-is.
  @Prop({ enum: ['government', 'private', 'institution'], required: true }) provider: string;
  // Display name of the actual awarding body, e.g. "AICTE", "Sitaram Jindal Foundation".
  @Prop() providerName?: string;
  @Prop() providerId?: string;

  // Scholarship-category taxonomy slugs (references ScholarshipCategory) —
  // e.g. ['merit', 'sc-st', 'engineering']. A scholarship can belong to many.
  @Prop({ type: [String], default: [] }) categories: string[];
  // Free descriptor for the UI's "Scholarship Type" field, e.g.
  // 'merit' | 'means' | 'merit-cum-means' | 'sports' | 'minority' | …
  @Prop() type?: string;

  @Prop() description?: string;
  @Prop({ type: [String], default: [] }) benefits: string[];

  @Prop({ type: Eligibility, required: true }) eligibility: Eligibility;
  @Prop({ type: AwardAmount, required: true }) awardAmount: AwardAmount;

  @Prop({ type: [String], default: [] }) documents: string[];
  @Prop({ type: [ApplicationStep], default: [] }) applicationSteps: ApplicationStep[];
  @Prop({ enum: ['online', 'offline', 'both'], default: 'online' }) applicationMode: string;

  @Prop({ type: [Faq], default: [] }) faqs: Faq[];
  @Prop({ type: ApplicationLinks, default: () => ({}) }) links: ApplicationLinks;
  @Prop({ type: ContactInfo, default: () => ({}) }) contact: ContactInfo;

  // Kept flat (not nested) — the AI Counsellor's context aggregator and the
  // Admission Predictor both read `applicationDeadline` directly.
  @Prop() applicationOpensAt?: Date;
  @Prop({ required: true }) applicationDeadline: Date;
  @Prop() renewalPolicy?: string;

  @Prop({ default: false }) featured: boolean;
  @Prop({ default: true }) isActive: boolean;
}

export const ScholarshipSchema = SchemaFactory.createForClass(Scholarship);
ScholarshipSchema.index({ applicationDeadline: 1 });
ScholarshipSchema.index({ 'eligibility.categories': 1, 'eligibility.states': 1, 'eligibility.exams': 1 });
ScholarshipSchema.index({ isActive: 1 });
ScholarshipSchema.index({ categories: 1 });
ScholarshipSchema.index({ featured: 1 });
