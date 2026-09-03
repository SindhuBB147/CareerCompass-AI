import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsEnum, IsIn, IsInt, IsNumber, IsOptional,
  IsString, Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ONBOARDING_EXAM_OPTIONS, SUPPORTED_EXAM_CODES } from '../models/user.model';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsEnum(['General', 'OBC', 'SC', 'ST', 'EWS', 'Other']) category?: string;
  @IsOptional() @IsString() domicileState?: string;
  @IsOptional() @IsInt() @Min(0) budgetMax?: number;
  @IsOptional() @IsEnum(['conservative', 'balanced', 'aggressive']) riskAppetite?: string;
  @IsOptional() @IsInt() @Min(0) familyIncomeAnnual?: number;
  @IsOptional() @IsEnum(['light', 'dark', 'system']) preferredTheme?: string;
  @IsOptional() @IsString() preferredLanguage?: string;
  @IsOptional() @IsString() currentCollege?: string;
  // email deliberately omitted — email changes go through the
  // email-verification flow, not the generic profile update.
}

export class AddExamProfileDto {
  @IsIn(SUPPORTED_EXAM_CODES) examCode: string;
  @IsInt() year: number;
  @IsInt() @Min(1) rank: number;
  @IsOptional() @IsString() categoryUsed?: string;
}

export class UpdateExamProfileDto {
  @IsOptional() @IsInt() @Min(1) rank?: number;
  @IsOptional() @IsString() categoryUsed?: string;
  @IsOptional() @IsEnum(['active', 'completed']) status?: string;
}

export class UpdateNotificationPreferencesDto {
  @IsOptional() @IsBoolean() sms?: boolean;
  @IsOptional() @IsBoolean() email?: boolean;
  @IsOptional() @IsBoolean() whatsapp?: boolean;
  @IsOptional() @IsBoolean() push?: boolean;
}

export class RequestEmailVerificationDto {
  @IsEmail() email: string;
}

export class ConfirmEmailVerificationDto {
  @IsString() token: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Onboarding wizard — one DTO per step, saved independently so progress
// persists as the student moves through the wizard.
// ═══════════════════════════════════════════════════════════════════════

export class OnboardingStep1Dto {
  @IsOptional() @IsString() photoUrl?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) fullName?: string;
  @IsOptional() @IsEnum(['male', 'female', 'other', 'prefer_not_to_say']) gender?: string;
  @IsOptional() @IsString() dob?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() @MaxLength(10) pinCode?: string;
  @IsOptional() @IsString() preferredLanguage?: string;
}

export class OnboardingStep2Dto {
  @IsOptional() @IsString() currentQualification?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(100) tenthPercentage?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) twelfthPercentage?: number;
  @IsOptional() @IsString() diploma?: string;
  @IsOptional() @IsString() pucBoard?: string;
  @IsOptional() @IsInt() @Min(1990) yearOfPassing?: number;
  @IsOptional() @IsInt() @Min(0) @Max(10) gapYears?: number;
}

export class OnboardingExamEntryDto {
  @IsIn(ONBOARDING_EXAM_OPTIONS) examCode: string;
  @IsOptional() @IsInt() @Min(1) rank?: number;
  @IsOptional() @IsInt() @Min(1) categoryRank?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(100) percentile?: number;
  @IsInt() attemptYear: number;
}

export class OnboardingStep3Dto {
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => OnboardingExamEntryDto)
  exams: OnboardingExamEntryDto[];
}

export class OnboardingStep4Dto {
  @IsOptional() @IsIn(['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'EWS']) reservationCategory?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) horizontalReservations?: string[];
}

export class OnboardingStep5Dto {
  @IsOptional() @IsString() preferredExam?: string;
  @IsOptional() @IsString() preferredDiscipline?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) preferredCourses?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredColleges?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) preferredCities?: string[];
  @IsOptional() @IsIn(['government', 'private', 'any']) collegeType?: string;
  @IsOptional() @IsBoolean() hostelRequired?: boolean;
  @IsOptional() @IsInt() @Min(0) budgetMax?: number;
  @IsOptional() @IsBoolean() loanRequired?: boolean;
  @IsOptional() @IsIn(['higher_studies', 'job', 'entrepreneurship', 'research', '']) postGraduationPlan?: string;
}

export class OnboardingStep6Dto {
  @IsOptional() @IsString() careerGoal?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) dreamCompanies?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) interestAreas?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) skills?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) programmingLanguages?: string[];
  @IsOptional() @IsString() learningStyle?: string;
  @IsOptional() @IsString() communicationLanguage?: string;
  @IsOptional() @IsBoolean() receiveAiSuggestions?: boolean;
  @IsOptional() @IsBoolean() receiveNotifications?: boolean;
}

export class LinkAccountDto {
  @IsIn(['google', 'microsoft', 'github', 'apple', 'linkedin']) provider: string;
  @IsString() idTokenTokenOrCode: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsEmail() email?: string;
}

export class DeleteAccountDto {
  @IsIn(['DELETE']) confirm: string;
}
