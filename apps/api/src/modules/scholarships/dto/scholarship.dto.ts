import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsDate, IsEnum, IsIn, IsInt, IsNumber,
  IsOptional, IsString, IsUrl, Min, ValidateNested,
} from 'class-validator';

// ── Nested sub-DTOs ──────────────────────────────────────────────────────────

export class EligibilityDto {
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
  @IsOptional() @IsNumber() maxIncome?: number;
  @IsOptional() @IsNumber() minIncome?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) states?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) exams?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) applicableCourses?: string[];
  @IsOptional() @IsString() genderSpecific?: string;
  @IsOptional() @IsBoolean() minorityOnly?: boolean;
  @IsOptional() @IsBoolean() pwdOnly?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) requiredReservations?: string[];
  @IsOptional() @IsInt() @Min(1) minRank?: number;
  @IsOptional() @IsInt() maxRank?: number;
  @IsOptional() @IsNumber() @Min(0) minAcademicPercent?: number;
  @IsOptional() @IsString() academicCriteriaNote?: string;
}

export class AwardAmountDto {
  @IsEnum(['fixed', 'percentage']) type: string;
  @IsNumber() @Min(0) value: number;
  @IsOptional() @IsString() displayText?: string;
}

export class ApplicationStepDto {
  @IsInt() @Min(1) stepNumber: number;
  @IsString() title: string;
  @IsString() description: string;
}

export class FaqDto {
  @IsString() question: string;
  @IsString() answer: string;
}

export class ApplicationLinksDto {
  @IsOptional() @IsUrl() officialWebsite?: string;
  @IsOptional() @IsUrl() applyLink?: string;
  @IsOptional() @IsUrl() notificationPdf?: string;
  @IsOptional() @IsUrl() guidelinesPdf?: string;
  @IsOptional() @IsUrl() helpdeskUrl?: string;
}

export class ContactInfoDto {
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
}

// ── Create / Update ──────────────────────────────────────────────────────────

export class CreateScholarshipDto {
  @IsString() name: string;
  @IsEnum(['government', 'private', 'institution']) provider: string;
  @IsOptional() @IsString() providerName?: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) benefits?: string[];

  @ValidateNested() @Type(() => EligibilityDto) eligibility: EligibilityDto;
  @ValidateNested() @Type(() => AwardAmountDto) awardAmount: AwardAmountDto;

  @IsOptional() @IsArray() @IsString({ each: true }) documents?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ApplicationStepDto) applicationSteps?: ApplicationStepDto[];
  @IsOptional() @IsIn(['online', 'offline', 'both']) applicationMode?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FaqDto) faqs?: FaqDto[];
  @IsOptional() @ValidateNested() @Type(() => ApplicationLinksDto) links?: ApplicationLinksDto;
  @IsOptional() @ValidateNested() @Type(() => ContactInfoDto) contact?: ContactInfoDto;

  @IsOptional() @IsDate() @Type(() => Date) applicationOpensAt?: Date;
  @IsDate() @Type(() => Date) applicationDeadline: Date;
  @IsOptional() @IsString() renewalPolicy?: string;

  @IsOptional() @IsBoolean() featured?: boolean;
}

export class UpdateScholarshipDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEnum(['government', 'private', 'institution']) provider?: string;
  @IsOptional() @IsString() providerName?: string;
  @IsOptional() @IsString() providerId?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) benefits?: string[];

  @IsOptional() @ValidateNested() @Type(() => EligibilityDto) eligibility?: EligibilityDto;
  @IsOptional() @ValidateNested() @Type(() => AwardAmountDto) awardAmount?: AwardAmountDto;

  @IsOptional() @IsArray() @IsString({ each: true }) documents?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ApplicationStepDto) applicationSteps?: ApplicationStepDto[];
  @IsOptional() @IsIn(['online', 'offline', 'both']) applicationMode?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FaqDto) faqs?: FaqDto[];
  @IsOptional() @ValidateNested() @Type(() => ApplicationLinksDto) links?: ApplicationLinksDto;
  @IsOptional() @ValidateNested() @Type(() => ContactInfoDto) contact?: ContactInfoDto;

  @IsOptional() @IsDate() @Type(() => Date) applicationOpensAt?: Date;
  @IsOptional() @IsDate() @Type(() => Date) applicationDeadline?: Date;
  @IsOptional() @IsString() renewalPolicy?: string;

  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── Query DTOs ────────────────────────────────────────────────────────────────

export class ListScholarshipsDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsIn(['KCET', 'COMEDK', 'NEET']) exam?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(['government', 'private', 'institution']) provider?: string;
  @IsOptional() @IsString() reservation?: string;
  @IsOptional() @IsNumber() income?: number;
  @IsOptional() @IsIn(['open', 'upcoming', 'expired', 'all']) status?: 'open' | 'upcoming' | 'expired' | 'all';
  @IsOptional() @IsIn(['deadline', 'amount', 'newest']) sortBy?: 'deadline' | 'amount' | 'newest';
  @IsOptional() @IsBoolean() featuredOnly?: boolean;
  @IsOptional() page?: number;
  @IsOptional() limit?: number;
}

export class AdminListScholarshipsDto extends ListScholarshipsDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
}
