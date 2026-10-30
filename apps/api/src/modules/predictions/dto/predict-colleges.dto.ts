import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class PredictorFiltersDto {
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() collegeType?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsNumber() @Min(0) minFee?: number;
  @IsOptional() @IsNumber() @Min(0) maxFee?: number;
  @IsOptional() @IsBoolean() hostelRequired?: boolean;
  /** Minimum average placement package, in LPA. */
  @IsOptional() @IsNumber() @Min(0) minPlacementAverage?: number;
  @IsOptional() @IsInt() @Min(1) maxNirfRank?: number;
  @IsOptional() @IsInt() @Min(0) @Max(100) minProbabilityPercent?: number;
}

export class PredictCollegesDto {
  @IsIn(['KCET', 'COMEDK', 'NEET', 'JEE']) examCode: 'KCET' | 'COMEDK' | 'NEET' | 'JEE';

  @IsInt() @Min(1) @Max(2000000) rank: number;

  /** KCET/NEET reservation category, or source-defined COMEDK seat type. */
  @IsOptional() @IsString() category?: string;

  /** Optional source-year and round filters for historical COMEDK cutoffs. */
  @IsOptional() @IsInt() @Min(2000) @Max(2100) cutoffYear?: number;
  @IsOptional() @IsInt() @Min(1) @Max(10) cutoffRound?: number;

  /** KCET only — one of KCET_DISCIPLINE_OPTIONS' labels. */
  @IsOptional() @IsString() discipline?: string;

  /** Required for COMEDK/NEET, and for KCET when discipline === 'Engineering'. */
  @IsOptional() @IsArray() @IsString({ each: true }) courseSelections?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) horizontalReservations?: string[];

  @IsOptional() @ValidateNested() @Type(() => PredictorFiltersDto) filters?: PredictorFiltersDto;

  @IsOptional() @IsIn(['nirf', 'fee_asc', 'placement_desc']) sortBy: 'nirf' | 'fee_asc' | 'placement_desc' = 'nirf';

  @IsOptional() @IsInt() @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit: number = 20;
}
