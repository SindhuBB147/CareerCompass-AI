import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, ValidateNested,
} from 'class-validator';

export class PredictorFiltersDto {
  @IsOptional() @IsIn(['Government', 'Private', 'Autonomous', 'Deemed']) collegeType?: string;
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
  @IsIn(['KCET', 'COMEDK', 'NEET']) examCode: 'KCET' | 'COMEDK' | 'NEET';

  @IsInt() @Min(1) @Max(2000000) rank: number;

  /** Required for KCET/NEET (validated per-exam in the service); ignored for COMEDK. */
  @IsOptional() @IsString() category?: string;

  /** KCET only — one of KCET_DISCIPLINE_OPTIONS' labels. */
  @IsOptional() @IsString() discipline?: string;

  /** Required for COMEDK/NEET, and for KCET when discipline === 'Engineering'. */
  @IsOptional() @IsArray() @IsString({ each: true }) courseSelections?: string[];

  @IsOptional() @IsArray() @IsString({ each: true }) horizontalReservations?: string[];

  @IsOptional() @ValidateNested() @Type(() => PredictorFiltersDto) filters?: PredictorFiltersDto;

  @IsOptional() @IsIn(['nirf', 'probability']) sortBy: 'nirf' | 'probability' = 'nirf';

  @IsOptional() @IsInt() @Min(1) page: number = 1;
  @IsOptional() @IsInt() @Min(1) @Max(50) limit: number = 20;
}
