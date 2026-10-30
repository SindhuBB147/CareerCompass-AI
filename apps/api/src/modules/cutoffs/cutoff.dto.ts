import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export const CUTOFF_STATUSES = ['verified', 'needs_review', 'imported', 'archived', 'invalid'] as const;
export type CutoffStatus = typeof CUTOFF_STATUSES[number];

export class CutoffQueryDto {
  @IsOptional() @IsString() examCode?: string;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() round?: number;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsIn(CUTOFF_STATUSES) status?: CutoffStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit: number = 50;
  @IsOptional() @IsString() sortBy: string = 'year';
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder: 'asc' | 'desc' = 'desc';
}

export class CutoffTrendQueryDto {
  @IsString() courseId: string;
  @IsString() examCode: string;
  @IsOptional() @IsString() category: string = 'GM';
}

export class BulkRowDto {
  @IsString() collegeId: string;
  @IsString() courseId: string;
  @IsOptional() @IsString() courseName?: string;
  @IsString() examCode: string;
  @IsInt() year: number;
  @IsInt() @Min(1) round: number;
  @IsString() category: string;
  @IsOptional() @IsString() branch?: string;
  @IsInt() @Min(1) closingRank: number;
}

export class BulkUploadDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BulkRowDto)
  rows: BulkRowDto[];
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsBoolean() overwriteExisting?: boolean;
}

export class ValidateRowsDto {
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => BulkRowDto)
  rows: BulkRowDto[];
}

export class CreateCutoffDto extends BulkRowDto {}

export class UpdateCutoffDto {
  @IsOptional() @IsInt() @Min(1) closingRank?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsIn(CUTOFF_STATUSES) status?: CutoffStatus;
}

export class UpdateCutoffStatusDto {
  @IsIn(CUTOFF_STATUSES) status: CutoffStatus;
}

export class ResolveConflictDto {
  @IsInt() @Min(1) resolvedValue: number;
}

export class CutoffPdfExportQueryDto {
  @IsOptional() @IsString() collegeId?: string;
  @IsOptional() @IsString() examCode?: string;
  @IsOptional() @Type(() => Number) @IsInt() year?: number;
  @IsOptional() @Type(() => Number) @IsInt() round?: number;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() branch?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() sortBy?: string;
  @IsOptional() @IsIn(['asc', 'desc']) sortOrder?: 'asc' | 'desc';
}
