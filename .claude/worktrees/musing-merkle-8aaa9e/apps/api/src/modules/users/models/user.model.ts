import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

class ExamProfile {
  @Prop({ required: true }) examCode: string;
  @Prop({ required: true }) year: number;
  @Prop({ required: true }) rank: number;
  @Prop() categoryUsed?: string;
  // Additive fields for the onboarding "Entrance Examination" step — the
  // prediction engine only ever reads examCode/year/rank/categoryUsed, so
  // these are safe, optional extensions.
  @Prop() categoryRank?: number;
  @Prop() percentile?: number;
  @Prop({ enum: ['active', 'completed'], default: 'active' }) status: string;
}

class Preferences {
  @Prop() budgetMax?: number;
  @Prop({ type: [String], default: [] }) preferredStates: string[];
  @Prop({ type: [String], default: [] }) preferredCourses: string[];
  @Prop() preferredExam?: string;
  @Prop() preferredDiscipline?: string;
  @Prop({ enum: ['conservative', 'balanced', 'aggressive'], default: 'balanced' })
  riskAppetite: string;
  // Career-preference additions (onboarding Step 5) — kept on the existing
  // Preferences subdocument rather than a new one since they're the same
  // "what the student wants" concern the predictor already reads budget/
  // courses/states from.
  @Prop({ type: [String], default: [] }) preferredColleges: string[];
  @Prop({ type: [String], default: [] }) preferredCities: string[];
  @Prop({ enum: ['government', 'private', 'any'], default: 'any' }) collegeType: string;
  @Prop({ default: false }) hostelRequired: boolean;
  @Prop({ default: false }) loanRequired: boolean;
  @Prop({ enum: ['higher_studies', 'job', 'entrepreneurship', 'research', ''], default: '' })
  postGraduationPlan: string;
}

class NotificationChannels {
  @Prop({ default: true }) sms: boolean;
  @Prop({ default: false }) email: boolean;
  @Prop({ default: false }) whatsapp: boolean;
  @Prop({ default: false }) push: boolean;
}

class AcademicInfo {
  @Prop() currentQualification?: string;
  @Prop() tenthPercentage?: number;
  @Prop() twelfthPercentage?: number;
  @Prop() diploma?: string;
  @Prop() pucBoard?: string;
  @Prop() yearOfPassing?: number;
  @Prop({ default: 0 }) gapYears: number;
  // Read only by the Career Roadmap generator to phase-personalize a
  // student's milestones (which years are "already behind you" vs.
  // upcoming) — optional and additive, no other module reads these.
  @Prop() currentSemester?: number;
  @Prop() branch?: string;
  // Profile Memory field — the college the student is currently enrolled
  // at (distinct from preferences.preferredColleges, which is aspirational).
  @Prop() currentCollege?: string;
}

// Karnataka KEA reservation category — kept separate from the legacy
// `category` field (General/OBC/SC/ST/EWS/Other) that the prediction/cutoff
// engines already match against, so this addition can't silently change
// prediction results for existing users.
class CategoryReservation {
  @Prop({ enum: ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'EWS', ''], default: '' })
  reservationCategory: string;
  @Prop({ type: [String], default: [] }) horizontalReservations: string[];
}

class AiPersonalization {
  @Prop() careerGoal?: string;
  @Prop({ type: [String], default: [] }) dreamCompanies: string[];
  @Prop({ type: [String], default: [] }) interestAreas: string[];
  @Prop({ type: [String], default: [] }) skills: string[];
  @Prop({ type: [String], default: [] }) programmingLanguages: string[];
  @Prop() learningStyle?: string;
  @Prop() communicationLanguage?: string;
  @Prop({ default: true }) receiveAiSuggestions: boolean;
  @Prop({ default: true }) receiveNotifications: boolean;
  // Memory & Privacy toggles — receiveAiSuggestions already doubles as the
  // "AI personalization" master switch; these two are the finer-grained
  // controls the Memory & Privacy page exposes on top of it.
  @Prop({ default: true }) conversationMemoryEnabled: boolean;
  @Prop({ default: true }) searchHistoryEnabled: boolean;
}

export type LinkedAccountProvider = 'google' | 'microsoft' | 'github' | 'apple' | 'linkedin';

class LinkedAccount {
  @Prop({ type: String, required: true, enum: ['google', 'microsoft', 'github', 'apple', 'linkedin'] })
  provider: LinkedAccountProvider;
  @Prop() providerId?: string;
  @Prop() email?: string;
  @Prop({ type: Date, default: Date.now }) linkedAt: Date;
}

/**
 * One entry per refreshed device/browser — replaces the single
 * currentRefreshTokenHash field the AdminUser model uses. Students need
 * multi-device sessions ("logout from all devices" per device, not just
 * globally), so refresh tokens are tracked as a list instead.
 */
class StudentSession {
  @Prop({ required: true }) sessionId: string;
  @Prop({ required: true }) refreshTokenHash: string;
  @Prop() userAgent?: string;
  @Prop() ip?: string;
  @Prop({ type: Date, default: Date.now }) createdAt: Date;
  @Prop({ type: Date, default: Date.now }) lastUsedAt: Date;
}

class OnboardingState {
  @Prop({ default: 1 }) currentStep: number;
  @Prop({ type: [Number], default: [] }) completedSteps: number[];
  @Prop({ default: false }) completed: boolean;
  @Prop({ type: Date, default: null }) completedAt: Date | null;
}

// SUPPORTED EXAMS — Karnataka scope. Only these four exam codes are valid
// for the prediction engine (single-exam-profile endpoint below).
export const SUPPORTED_EXAM_CODES = ['KCET', 'COMEDK', 'JEE', 'NEET'] as const;
export type SupportedExamCode = typeof SUPPORTED_EXAM_CODES[number];

// Broader exam list for the onboarding wizard's Step 3 (informational —
// examProfiles has no DB-level enum, so these extra codes coexist safely
// alongside SUPPORTED_EXAM_CODES; the prediction engine only ever reads
// KCET/COMEDK/NEET profiles and ignores the rest).
export const ONBOARDING_EXAM_OPTIONS = ['KCET', 'COMEDK', 'NEET', 'JEE_MAIN', 'JEE_ADVANCED', 'OTHER'] as const;
export type OnboardingExamOption = typeof ONBOARDING_EXAM_OPTIONS[number];

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true }) fullName: string;
  // Optional/sparse-unique — OTP signups have a phone and no email; OAuth
  // signups (Google/GitHub) have an email and no phone. At least one of the
  // two identifies the account; enforcing that isn't a schema-level
  // constraint Mongoose can express cleanly, so it's validated by whichever
  // signup path creates the record.
  @Prop({ unique: true, sparse: true }) phone?: string;
  @Prop({ unique: true, sparse: true }) email?: string;
  @Prop({ default: false }) isEmailVerified: boolean;
  @Prop({ enum: ['otp', 'password', 'google', 'microsoft', 'github', 'apple', 'linkedin'], default: 'otp' })
  authProvider: string;
  // Present only for email+password accounts — OAuth-only accounts have no
  // local password to compromise if the DB leaks.
  @Prop({ type: String, default: null }) passwordHash: string | null;
  @Prop() dob?: Date;
  @Prop({ enum: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'] }) category?: string;
  @Prop() domicileState?: string;
  // Annual family income (₹) — read by the Scholarship module's eligibility
  // engine for income-capped scholarships; not asked anywhere else, so it
  // stays optional and eligibility checks degrade to "unknown" without it.
  @Prop() familyIncomeAnnual?: number;

  // — Personal info (onboarding step 1) —
  @Prop() photoUrl?: string;
  @Prop({ enum: ['male', 'female', 'other', 'prefer_not_to_say', ''], default: '' }) gender: string;
  @Prop() district?: string;
  @Prop() city?: string;
  @Prop() pinCode?: string;
  // Matches the full language names the onboarding wizard's dropdown uses
  // (English/Kannada/Hindi/…), not an ISO code, so a freshly hydrated
  // wizard step doesn't clobber the dropdown's own 'English' default with
  // an unrecognized 'en' value before the student has chosen anything.
  @Prop({ default: 'English' }) preferredLanguage: string;
  // Profile Memory / session-restore field — no visual dark-mode exists on
  // the student site today; this stores the preference so it round-trips
  // and is ready for a future theme toggle without a schema change.
  @Prop({ enum: ['light', 'dark', 'system'], default: 'light' }) preferredTheme: string;

  @Prop({ type: AcademicInfo, default: () => ({}) }) academic: AcademicInfo;
  @Prop({ type: [ExamProfile], default: [] }) examProfiles: ExamProfile[];
  @Prop({ type: CategoryReservation, default: () => ({}) }) categoryReservation: CategoryReservation;
  @Prop({ type: Preferences, default: () => ({}) }) preferences: Preferences;
  @Prop({ type: AiPersonalization, default: () => ({}) }) aiPersonalization: AiPersonalization;
  @Prop({ type: NotificationChannels, default: () => ({}) }) notificationChannels: NotificationChannels;
  @Prop({ type: [LinkedAccount], default: [] }) linkedAccounts: LinkedAccount[];
  @Prop({ type: [StudentSession], default: [] }) sessions: StudentSession[];
  @Prop({ type: OnboardingState, default: () => ({}) }) onboarding: OnboardingState;

  @Prop({ enum: ['active', 'suspended', 'deleted'], default: 'active' }) accountStatus: string;
  @Prop({ type: Date, default: null }) lastLoginAt: Date | null;

  // — Security module additions —
  @Prop({ type: Date, default: null }) passwordChangedAt: Date | null;
  // Last 5 password hashes (most recent first) — checked by
  // PasswordPolicyService to block immediate password reuse.
  @Prop({ type: [String], default: [] }) passwordHistory: string[];
  @Prop({ type: Date, default: null }) lockedUntil: Date | null;
  @Prop({ default: 0 }) failedLoginCount: number;
  // Denormalized flags mirroring the TwoFactorAuth document (source of
  // truth) — read on the hot login path in AuthService, which intentionally
  // has no dependency on the security module's repositories (see
  // modules/security/security.module.ts header comment on the dependency
  // direction). twoFactorTrustedDeviceFingerprints is a copy of
  // TwoFactorAuth.trustedDeviceFingerprints kept for the same reason: it
  // lets AuthService skip the 2FA challenge for a remembered device without
  // a cross-module query.
  @Prop({ default: false }) twoFactorEnabled: boolean;
  @Prop({ type: String, default: null }) twoFactorMethod: string | null;
  @Prop({ type: [String], default: [] }) twoFactorTrustedDeviceFingerprints: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ 'examProfiles.examCode': 1 });
UserSchema.index({ domicileState: 1, category: 1 });
UserSchema.index({ 'sessions.sessionId': 1 });
UserSchema.index({ 'linkedAccounts.provider': 1, 'linkedAccounts.providerId': 1 });
