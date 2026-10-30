import { Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsNumber, IsOptional, IsString, Length, Max, Min, ValidateNested,
} from 'class-validator';

// Structurally compatible with SearchCollegesParams (apps/web/src/lib/colleges-api.ts)
// / CollegeSearchFilters (colleges/repositories/college.repository.ts) so the
// existing FilterPanel.tsx can be reused as-is for the Colleges tab of search
// results — this DTO only omits the fields SearchQueryDto already owns
// (q/page/limit) or that ranking recomputes (sortBy/sortOrder).
export class SearchFiltersDto {
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() collegeType?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() discipline?: string;
  @IsOptional() @IsString() examCode?: string;
  @IsOptional() @IsNumber() minFee?: number;
  @IsOptional() @IsNumber() maxFee?: number;
  @IsOptional() @IsNumber() maxNirf?: number;
  @IsOptional() @IsString() naac?: string;
  @IsOptional() @IsBoolean() nbaOnly?: boolean;
  @IsOptional() @IsBoolean() aicteApproved?: boolean;
  @IsOptional() @IsBoolean() hostelAvailable?: boolean;
}

export class SearchQueryDto {
  @IsString() @Length(1, 500) query: string;

  @IsOptional() @ValidateNested() @Type(() => SearchFiltersDto) filters?: SearchFiltersDto;

  @IsOptional() @IsInt() @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit: number = 10;
}

export class VoiceSearchDto {
  @IsString() @Length(1, 500) transcript: string;

  @IsOptional() @ValidateNested() @Type(() => SearchFiltersDto) filters?: SearchFiltersDto;
}

export class SaveSearchDto {
  @IsString() historyId: string;

  @IsOptional() @IsString() @Length(1, 100) label?: string;
}

export class SummarizeDto {
  @IsString() @Length(1, 500) query: string;
}
