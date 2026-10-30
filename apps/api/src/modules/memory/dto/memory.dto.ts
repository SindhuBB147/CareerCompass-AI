import { IsBoolean, IsEnum, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateConsentDto {
  @IsOptional() @IsBoolean() functional?: boolean;
  @IsOptional() @IsBoolean() analytics?: boolean;
  @IsOptional() @IsBoolean() preference?: boolean;
  @IsOptional() @IsBoolean() aiPersonalization?: boolean;
  @IsIn(['accept_all', 'reject_optional', 'customize']) action: string;
}

export const MEMORY_CATEGORIES = [
  'searchHistory', 'conversationHistory', 'aiMemorySlots', 'recentlyViewedColleges',
  'financialPlanHistory', 'scholarshipInteractions', 'sessionState',
] as const;

export class PatchSessionStateDto {
  @IsOptional() @IsString() lastDashboard?: string;
  @IsOptional() @IsObject() openFilters?: Record<string, unknown>;
  @IsOptional() @IsObject() sortPreferences?: Record<string, unknown>;
  @IsOptional() @IsObject() paginationState?: Record<string, unknown>;
  @IsOptional() @IsEnum(['light', 'dark', 'system']) theme?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsString() lastAiSessionId?: string;
}

export class UpdatePersonalizationSettingsDto {
  @IsOptional() @IsBoolean() aiPersonalizationEnabled?: boolean;
  @IsOptional() @IsBoolean() conversationMemoryEnabled?: boolean;
  @IsOptional() @IsBoolean() searchHistoryEnabled?: boolean;
}
