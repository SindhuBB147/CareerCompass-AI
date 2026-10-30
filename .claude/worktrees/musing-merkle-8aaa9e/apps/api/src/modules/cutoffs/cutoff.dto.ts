// ── DTOs ──────────────────────────────────────────────────────────────────────
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

// 'General'/'OBC'/'Other' are the platform's original placeholder taxonomy
// (still valid — existing seeded cutoff rows use 'General'). GM/Cat-1/2A/2B/
// 3A/3B are the real Karnataka KCET/COMEDK/NEET rank-list category codes,
// added for the Admission Probability Predictor (see predictions module) —
// additive so nothing existing breaks.
export const SUPPORTED_CATEGORIES = [
  'General', 'OBC', 'SC', 'ST', 'EWS', 'Other',
  'GM', 'Cat-1', '2A', '2B', '3A', '3B',
];

export class CutoffTrendQueryDto {
  @IsString() courseId: string;
  @IsString() examCode: string;
  @IsOptional() @IsIn(SUPPORTED_CATEGORIES) category: string = 'General';
}

export class BulkRowDto {
  @IsString() collegeId: string;
  @IsString() courseId: string;
  @IsString() examCode: string;
  @IsInt() year: number;
  @IsInt() @Min(1) round: number;
  @IsIn(SUPPORTED_CATEGORIES) category: string;
  @IsOptional() @IsInt() @Min(1) openingRank?: number;
  @IsInt() @Min(1) closingRank: number;
  @IsOptional() @IsInt() @Min(0) seatsAvailable?: number;
}

export class BulkUploadDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BulkRowDto)
  rows: BulkRowDto[];
}

export class ResolveConflictDto {
  @IsInt() @Min(1) resolvedValue: number;
}
