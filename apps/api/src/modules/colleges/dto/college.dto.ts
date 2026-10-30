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
  // Admin-only: the public site never sends this, so archived colleges never
  // surface there. Kept on the shared search DTO rather than a separate
  // admin endpoint since the admin list reuses this same GET /colleges route.
  @IsOptional() @IsBoolean() includeArchived?: boolean;
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
  @IsOptional() @IsString() googleMapQuery?: string;
  @IsOptional() @IsString() admissionPhone?: string;
  @IsOptional() @IsEmail() admissionEmail?: string;
  @IsOptional() @IsString() placementPhone?: string;
  @IsOptional() @IsEmail() placementEmail?: string;
}

class HostelInfoDto {
  @IsOptional() @IsBoolean() boysHostel?: boolean;
  @IsOptional() @IsBoolean() girlsHostel?: boolean;
  @IsOptional() @IsInt() @Min(0) capacity?: number;
  @IsOptional() @IsArray() @IsString({ each: true }) roomTypes?: string[];
  @IsOptional() @IsString() messDetails?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) amenities?: string[];
  @IsOptional() @IsNumber() hostelFeePerYear?: number;
  @IsOptional() @IsString() hostelFeeAcademicYear?: string;
}

class FeeBreakdownDto {
  @IsOptional() @IsNumber() @Min(0) tuitionFee?: number;
  @IsOptional() @IsNumber() @Min(0) hostelFee?: number;
  @IsOptional() @IsNumber() @Min(0) messFee?: number;
  @IsOptional() @IsNumber() @Min(0) otherCharges?: number;
  @IsOptional() @IsNumber() @Min(0) totalAnnualFee?: number;
  @IsOptional() @IsString() academicYear?: string;
}

class AboutInfoDto {
  @IsOptional() @IsString() summary?: string;
  @IsOptional() @IsString() history?: string;
  @IsOptional() @IsString() vision?: string;
  @IsOptional() @IsString() mission?: string;
}

class CampusInfoDto {
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) architectureHighlights?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) facilities?: string[];
}

class AdmissionRouteDto {
  @IsString() route: string;
  @IsOptional() @IsString() eligibility?: string;
  @IsOptional() @IsString() process?: string;
}

class DataMetadataDto {
  @IsOptional() @IsBoolean() dataVerified?: boolean;
  @IsOptional() @IsString() lastVerified?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) dataSources?: string[];
  @IsOptional() @IsString() dataVersion?: string;
}

class AlternateAdmissionCodeDto {
  @IsString() code: string;
  @IsString() examBody: string;
  @IsOptional() @IsString() note?: string;
}

// ─── College Images ─────────────────────────────────────────────────────────
export const GALLERY_CATEGORIES = ['Campus', 'Library', 'Labs', 'Hostels', 'Sports', 'Auditorium', 'Fest'];
export const IMAGE_VERIFICATION_STATUS_VALUES = ['verified', 'needs_review', 'rejected'];

export class AddGalleryImageDto {
  @IsIn(GALLERY_CATEGORIES) category: string;
  @IsString() url: string;
  @IsString() title: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsString() altText?: string;
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsString() sourceName?: string;
  @IsOptional() @IsIn(IMAGE_VERIFICATION_STATUS_VALUES) verificationStatus?: string;
  @IsOptional() @IsBoolean() setPrimary?: boolean;
}

export class UpdateGalleryImageDto {
  @IsOptional() @IsIn(GALLERY_CATEGORIES) category?: string;
  @IsOptional() @IsString() url?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() thumbnailUrl?: string;
  @IsOptional() @IsString() altText?: string;
  @IsOptional() @IsString() sourceUrl?: string;
  @IsOptional() @IsString() sourceName?: string;
  @IsOptional() @IsIn(IMAGE_VERIFICATION_STATUS_VALUES) verificationStatus?: string;
}

export class ReorderGalleryDto {
  @IsArray() @ArrayNotEmpty() @IsString({ each: true }) orderedIds: string[];
}

export class CreateCollegeDto {
  @IsOptional() @Matches(/^[A-Z]\d{3,}$/i) collegeId?: string;
  @IsString() name: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) aliasNames?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlternateAdmissionCodeDto) alternateAdmissionCodes?: AlternateAdmissionCodeDto[];
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
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @ValidateNested() @Type(() => AccreditationDto) accreditation?: AccreditationDto;
  @IsOptional() @ValidateNested() @Type(() => ContactDto) contact?: ContactDto;
  @IsOptional() @ValidateNested() @Type(() => FeeBreakdownDto) feeBreakdown?: FeeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => HostelInfoDto) hostelInfo?: HostelInfoDto;
  @IsOptional() @ValidateNested() @Type(() => AboutInfoDto) about?: AboutInfoDto;
  @IsOptional() @ValidateNested() @Type(() => CampusInfoDto) campus?: CampusInfoDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdmissionRouteDto) admissionRoutes?: AdmissionRouteDto[];
  @IsOptional() @ValidateNested() @Type(() => DataMetadataDto) metadata?: DataMetadataDto;
}

export class UpdateCollegeDto {
  @IsOptional() @Matches(/^[A-Z]\d{3,}$/i) collegeId?: string;
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AlternateAdmissionCodeDto) alternateAdmissionCodes?: AlternateAdmissionCodeDto[];
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
  @IsOptional() @IsNumber() @Min(-90) @Max(90) latitude?: number;
  @IsOptional() @IsNumber() @Min(-180) @Max(180) longitude?: number;
  @IsOptional() @ValidateNested() @Type(() => AccreditationDto) accreditation?: AccreditationDto;
  @IsOptional() @ValidateNested() @Type(() => ContactDto) contact?: ContactDto;
  @IsOptional() @ValidateNested() @Type(() => FeeBreakdownDto) feeBreakdown?: FeeBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => HostelInfoDto) hostelInfo?: HostelInfoDto;
  @IsOptional() @ValidateNested() @Type(() => AboutInfoDto) about?: AboutInfoDto;
  @IsOptional() @ValidateNested() @Type(() => CampusInfoDto) campus?: CampusInfoDto;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AdmissionRouteDto) admissionRoutes?: AdmissionRouteDto[];
  @IsOptional() @ValidateNested() @Type(() => DataMetadataDto) metadata?: DataMetadataDto;
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

// Mirrors models/college.model.ts CategorySeatBreakdown field-for-field — the
// admin seat-matrix form only surfaces a subset of these (see the frontend's
// compact category x quota grid) but the DTO itself accepts the full shape
// so a CSV/future bulk importer can populate every category without a
// separate DTO.
class CategorySeatBreakdownDto {
  @IsOptional() @IsInt() @Min(0) cat1_g?: number;
  @IsOptional() @IsInt() @Min(0) cat1_r?: number;
  @IsOptional() @IsInt() @Min(0) cat1_k?: number;
  @IsOptional() @IsInt() @Min(0) cat2a_g?: number;
  @IsOptional() @IsInt() @Min(0) cat2a_r?: number;
  @IsOptional() @IsInt() @Min(0) cat2a_k?: number;
  @IsOptional() @IsInt() @Min(0) cat2b_g?: number;
  @IsOptional() @IsInt() @Min(0) cat2b_r?: number;
  @IsOptional() @IsInt() @Min(0) cat2b_k?: number;
  @IsOptional() @IsInt() @Min(0) cat3a_g?: number;
  @IsOptional() @IsInt() @Min(0) cat3a_r?: number;
  @IsOptional() @IsInt() @Min(0) cat3a_k?: number;
  @IsOptional() @IsInt() @Min(0) cat3b_g?: number;
  @IsOptional() @IsInt() @Min(0) cat3b_r?: number;
  @IsOptional() @IsInt() @Min(0) cat3b_k?: number;
  @IsOptional() @IsInt() @Min(0) st_g?: number;
  @IsOptional() @IsInt() @Min(0) st_r?: number;
  @IsOptional() @IsInt() @Min(0) st_k?: number;
  @IsOptional() @IsInt() @Min(0) sc_g?: number;
  @IsOptional() @IsInt() @Min(0) sc_r?: number;
  @IsOptional() @IsInt() @Min(0) sc_k?: number;
  @IsOptional() @IsInt() @Min(0) gm_g?: number;
  @IsOptional() @IsInt() @Min(0) gm_r?: number;
  @IsOptional() @IsInt() @Min(0) gm_k?: number;
  @IsOptional() @IsInt() @Min(0) total?: number;
}

export class UpdateSeatMatrixDto {
  @IsOptional() @IsString() academicYear?: string;
  @IsInt() @Min(0) totalSeats: number;
  @IsOptional() @ValidateNested() @Type(() => CategorySeatBreakdownDto) kkSeats?: CategorySeatBreakdownDto;
  @IsOptional() @ValidateNested() @Type(() => CategorySeatBreakdownDto) rkSeats?: CategorySeatBreakdownDto;
  @IsOptional() specialQuotaSeats?: Record<string, number>;
}
