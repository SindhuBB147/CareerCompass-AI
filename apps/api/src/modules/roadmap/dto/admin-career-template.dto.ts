import {
  IsArray, IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { CAREER_CATEGORIES } from '../roadmap.types';

// Phases/milestones are validated structurally by the admin UI's JSON
// editor (parse + shape check client-side) rather than field-by-field
// here — the nesting (phases -> milestones -> resources/certs/projects)
// is deep enough that a full class-validator tree would mostly duplicate
// the CareerTemplate Mongoose schema, which already rejects malformed
// documents on save.

export class CreateCareerTemplateDto {
  @IsString() @MinLength(2) @MaxLength(80) careerId: string;
  @IsString() @MinLength(2) @MaxLength(120) name: string;
  @IsIn(CAREER_CATEGORIES as unknown as string[]) category: string;
  @IsString() @MinLength(2) @MaxLength(500) description: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsArray() phases?: unknown[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateCareerTemplateDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) name?: string;
  @IsOptional() @IsIn(CAREER_CATEGORIES as unknown as string[]) category?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(500) description?: string;
  @IsOptional() @IsArray() tags?: string[];
  @IsOptional() @IsArray() phases?: unknown[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
