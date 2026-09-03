import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min,
} from 'class-validator';
import { BOOKMARK_STATUSES } from '../models/saved-college.model';

export const WISHLIST_SORT_OPTIONS = [
  'nirf', 'fees', 'placement', 'roi', 'admissionProbability', 'aiScore', 'name', 'recentlyAdded',
] as const;

// ─── Save / status / notes ──────────────────────────────────────────────────────
export class SaveCollegeDto {
  @IsOptional() @IsString() listId?: string;
  @IsOptional() @IsIn(BOOKMARK_STATUSES) status?: string;
}

export class SetStatusDto {
  @IsIn(BOOKMARK_STATUSES) status: string;
}

export class AddNoteDto {
  @IsString() text: string;
}

// ─── Lists ───────────────────────────────────────────────────────────────────
export class CreateListDto {
  @IsString() name: string;
  @IsOptional() @IsString() icon?: string;
}

export class RenameListDto {
  @IsString() name: string;
}

export class MoveCollegeDto {
  @IsString() fromListId: string;
  @IsString() toListId: string;
}

// ─── Wishlist read (sort/filter) ────────────────────────────────────────────────
export class ListWishlistQueryDto {
  @IsOptional() @IsString() listId?: string;
  @IsOptional() @IsIn(BOOKMARK_STATUSES) status?: string;
  @IsOptional() @IsIn(WISHLIST_SORT_OPTIONS) sortBy?: string;
  @IsOptional() @IsString() sortOrder?: 'asc' | 'desc';

  @IsOptional() @IsString() examCode?: string;
  @IsOptional() @IsString() collegeType?: string;
  @IsOptional() @IsString() course?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsInt() @Min(0) minFee?: number;
  @IsOptional() @IsInt() @Min(0) maxFee?: number;
  @IsOptional() @IsBoolean() hostelAvailable?: boolean;
  @IsOptional() @IsBoolean() scholarshipEligible?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) minAdmissionProbability?: number;
}

// ─── Compare ─────────────────────────────────────────────────────────────────
export class CompareSavedDto {
  @IsArray() @ArrayMinSize(2) @ArrayMaxSize(4) @IsString({ each: true })
  collegeIds: string[];
  @IsOptional() @IsString() name?: string;
}

// ─── Share ───────────────────────────────────────────────────────────────────
export class CreateShareDto {
  @IsIn(['wishlist', 'list', 'comparison']) kind: 'wishlist' | 'list' | 'comparison';
  @IsOptional() @IsArray() @IsString({ each: true }) collegeIds?: string[];
  @IsOptional() @IsString() listId?: string;
}
