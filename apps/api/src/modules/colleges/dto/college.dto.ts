import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, ArrayNotEmpty, IsArray, IsBoolean, IsEmail, IsIn,
  IsInt, IsNumber, IsOptional, IsString, IsUrl, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import { SUPPORTED_STATES } from '../models/college.model';

export const SUPPORTED_DEGREE_TYPES = [
  'B.E.', 'B.Tech', 'M.Tech', 'MCA', // Engineering
  'B.Arch', // Architecture (NATA)
  'MBBS', 'BDS', // Medical / Dental
  'BAMS', 'BUMS', 'BHMS', 'BNYS', // AYUSH
  'B.V.Sc & A.H', // Veterinary
  'B.Pharm', 'Pharma-D', // Pharmacy
  'B.Sc Nursing', 'B.Sc Agriculture', 'B.Sc Allied Health Sciences', 'BPT', // Nursing / Agriculture / Allied Health / Physiotherapy
];
export const KARNATAKA_EXAMS = ['KCET', 'COMEDK', 'JEE', 'NEET'];

// ─── College Search ───────────────────────────────────────────────────────────
export class SearchCollegesDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() collegeType?: string; // Government, Private, Autonomous, Deemed
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() discipline?: string; // Engineering, Medical, Dental, Architecture, ...
  @IsOptional() @IsString() examCode?: string;
  @IsOptional() @IsInt() @Min(0) minFee?: number;
  @IsOptional() @IsInt() @Min(0) maxFee?: number;
  @IsOptional() @IsInt() @Min(1) maxNirf?: number;
  @IsOptional() @IsString() naac?: string;
  @IsOptional() @IsBoolean() nbaOnly?: boolean;
  @IsOptional() @IsBoolean() aicteApproved?: boolean;
  @IsOptional() @IsBoolean() hostelAvailable?: boolean;
  @IsOptional() @IsString() sortBy?: 'nirf' | 'fees' | 'placement' | 'name' | 'rating';
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';
  @IsOptional() @IsInt() @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(100) limit: number = 20;
}

// ─── College Filter Facets ──────────────────────────────────────────────────────
export class CollegeFacetsQueryDto {
  @IsOptional() @IsString() examCode?: string;
}

export class CompareCollegesDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(4) @IsString({ each: true })
  collegeIds: string[];
}

export class CreateReviewDto {
  @IsString() userName: string;
  @IsNumber() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) academicsRating?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) placementRating?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) campusRating?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) hostelRating?: number;
  @IsOptional() @IsNumber() @Min(1) @Max(5) facultyRating?: number;
  @IsString() comment: string;
}

// ─── College Admin DTOs ────────────────────────────────────────────────────────
class AccreditationDto {
  @IsOptional() @IsString() naac?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) nbaCourses?: string[];
  @IsOptional() @IsInt() nirfRank?: number;
}

class ContactDto {
  @IsOptional() @IsUrl() website?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
}

class HostelInfoDto {
  @IsOptional() @IsBoolean() boysHostel?: boolean;
  @IsOptional() @IsBoolean() girlsHostel?: boolean;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
  @IsOptional() @IsString() messDetails?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
}

export class CreateCollegeDto {
  @IsString() name: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) aliasNames?: string[];
  @IsString() state: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() collegeType?: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  @IsOptional() @IsInt() establishedYear?: number;
  @IsOptional() @IsBoolean() aicteApproved?: boolean;
  @IsOptional() @IsString() bannerImage?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @ValidateNested() @Type(() => AccreditationDto) accreditation?: AccreditationDto;
  @IsOptional() @ValidateNested() @Type(() => ContactDto) contact?: ContactDto;
  @IsOptional() @ValidateNested() @Type(() => HostelInfoDto) hostelInfo?: HostelInfoDto;
}

export class UpdateCollegeDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() collegeType?: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  @IsOptional() @IsInt() establishedYear?: number;
  @IsOptional() @IsBoolean() aicteApproved?: boolean;
  @IsOptional() @IsBoolean() isVerified?: boolean;
  @IsOptional() @IsString() bannerImage?: string;
  @IsOptional() @IsString() logo?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) highlights?: string[];
  @IsOptional() @ValidateNested() @Type(() => AccreditationDto) accreditation?: AccreditationDto;
  @IsOptional() @ValidateNested() @Type(() => ContactDto) contact?: ContactDto;
  @IsOptional() @ValidateNested() @Type(() => HostelInfoDto) hostelInfo?: HostelInfoDto;
}

export class CreateCourseDto {
  @IsString() courseId: string;
  @IsString() name: string;
  @IsString() degreeType: string;
  @IsInt() @Min(1) intake: number;
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) examsAccepted: string[];
  @IsOptional() @IsNumber() feePerYear?: number;
  @IsOptional() @IsString() discipline?: string;
}

export class UpdateCourseDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() degreeType?: string;
  @IsOptional() @IsInt() @Min(1) intake?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) examsAccepted?: string[];
}

export class CreatePlacementDto {
  @IsInt() year: number;
  @IsNumber() highestPackage: number;
  @IsNumber() averagePackage: number;
  @IsNumber() medianPackage: number;
  @IsNumber() @Min(0) @Max(100) placementPercentage: number;
  @IsOptional() @IsArray() @IsString({ each: true }) topRecruiters?: string[];
}

export class UpdatePlacementDto {
  @IsOptional() @IsNumber() highestPackage?: number;
  @IsOptional() @IsNumber() averagePackage?: number;
  @IsOptional() @IsNumber() medianPackage?: number;
  @IsOptional() @IsNumber() placementPercentage?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) topRecruiters?: string[];
}

export class UpdateCourseFeeDto {
  @IsNumber() @Min(0) feePerYear: number;
}
