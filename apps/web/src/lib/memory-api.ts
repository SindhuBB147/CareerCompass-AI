// Typed client for the Memory & Privacy page — mirrors lib/notifications-api.ts's
// conventions on the shared apiClient. Backed by MemoryController /
// MemoryAggregatorService, a read/delete/export facade over every module's
// own memory store (see apps/api/src/modules/memory).

import { apiClient } from './api-client';
import { ConsentState } from './consent-api';
import { SessionState } from './session-state-api';

export type MemoryCategory =
  | 'searchHistory' | 'conversationHistory' | 'aiMemorySlots' | 'recentlyViewedColleges'
  | 'financialPlanHistory' | 'scholarshipInteractions' | 'sessionState';

export interface RememberedSlots {
  discipline?: string;
  city?: string;
  examCode?: string;
  category?: string;
  budgetMax?: number;
  collegeType?: string;
  hostelRequired?: boolean;
  placementFocus?: boolean;
  scholarshipFocus?: boolean;
  roiFocus?: boolean;
}

export interface PersonalizationSettings {
  aiPersonalizationEnabled: boolean;
  conversationMemoryEnabled: boolean;
  searchHistoryEnabled: boolean;
}

export interface MemorySummary {
  profile: {
    fullName?: string;
    preferredLanguage?: string;
    preferredTheme?: string;
    preferredExam?: string;
    preferredCourses?: string[];
    preferredColleges?: string[];
    preferredLocation?: string[];
    budgetMax?: number;
    careerGoal?: string;
    currentSemester?: number;
    currentCollege?: string;
  } | null;
  aiConversationMemory: { rememberedSlots: RememberedSlots; sessions: unknown[] };
  searchMemory: { recentSearches: unknown[]; savedSearches: unknown[] };
  recommendationMemory: { saved: unknown; recentlyViewed: unknown[] };
  admissionPredictorMemory: { predictions: unknown[] };
  financialPlannerMemory: { history: unknown[] };
  scholarshipMemory: { bookmarks: unknown[]; interactions: unknown[] };
  careerRoadmapMemory: { careerName: string; analytics: Record<string, unknown>; phases: unknown[] } | null;
  notificationMemory: { notifications: unknown[]; total: number };
  consent: ConsentState;
  sessionState: SessionState | null;
  personalizationSettings: PersonalizationSettings | null;
}

export const memoryApi = {
  getSummary: (token: string | null) => apiClient.get<MemorySummary>('/memory/summary', token),
  exportData: (token: string | null) => apiClient.get<Record<string, unknown>>('/memory/export', token),
  deleteCategory: (category: MemoryCategory, token: string | null) => apiClient.del<{ deleted: boolean }>(`/memory/${category}`, token),
  resetPersonalization: (token: string | null) => apiClient.post<{ reset: boolean }>('/memory/reset-personalization', undefined, token),
  updatePersonalizationSettings: (patch: Partial<PersonalizationSettings>, token: string | null) =>
    apiClient.patch<{ updated: boolean }>('/memory/personalization-settings', patch, token),
};
