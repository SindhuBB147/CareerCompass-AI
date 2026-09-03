import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CAREER_CATEGORIES, MILESTONE_STATUSES, MilestoneStatus } from '../roadmap.types';

export class GetRoadmapQueryDto {
  @IsOptional() @IsString() careerId?: string;
}

export class GenerateRoadmapDto {
  @IsString() careerId: string;
}

export class UpdateMilestoneDto {
  @IsOptional() @IsIn(MILESTONE_STATUSES as unknown as string[]) status?: MilestoneStatus;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ListCareersQueryDto {
  @IsOptional() @IsIn(CAREER_CATEGORIES as unknown as string[]) category?: string;
}
