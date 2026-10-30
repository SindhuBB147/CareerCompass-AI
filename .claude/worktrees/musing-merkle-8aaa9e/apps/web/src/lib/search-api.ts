// Typed client for the AI Smart Search module — follows the same
// apiClient-wrapping convention as colleges-api.ts / scholarships-api.ts.

import { apiClient } from './api-client';

export interface SearchEntities {
  exam: string | null;
  discipline: string | null;
  college_type: string | null;
  city: string | null;
  category: string | null;
  budget_max: number | null;
  nirf_max: number | null;
  rank: number | null;
  use_profile_rank: boolean;
  hostel_required: boolean;
  placement_focus: boolean;
  scholarship_focus: boolean;
  roi_focus: boolean;
  action: string | null;
  college_names: string[];
  sort_hint: string | null;
}

export interface ScoreBreakdown {
  entityMatch: number;
  personalizationFit: number;
  dataQuality: number;
  textRelevance: number;
  actionIntentBoost: number;
}

export interface CollegeResultCard {
  id: string;
  slug: string;
  name: string;
  bannerImage?: string;
  logo?: string;
  city: string;
  state: string;
  collegeType: string;
  nirfRank: number | null;
  naac: string | null;
  course: string | null;
  averagePackage: number | null;
  highestPackage: number | null;
  totalAnnualFee: number | null;
  hostelAvailable: boolean;
  scholarshipsAvailable: number | null;
  admissionProbability: { band: string; percent: number } | null;
  financialSummary: { totalProgramCost: number; netFinancialBurden: number } | null;
  aiScore: number;
  scoreBreakdown: ScoreBreakdown;
}

export interface ScholarshipResultItem {
  id: string;
  name: string;
  provider: string;
  awardAmount: { type: 'fixed' | 'percentage'; value: number; displayText?: string };
  applicationDeadline: string;
}

export interface SearchResponse {
  intent: string;
  entities: SearchEntities;
  colleges: CollegeResultCard[];
  scholarships: ScholarshipResultItem[];
  totalResults: number;
  suggestedFollowUps: string[];
  historyId: string | null;
}

export interface SummarizeResponse {
  summary: string;
  reasoning: string;
  citations: Array<{ tag: string; source_type: string; source_id: string; title: string; snippet: string }>;
  suggestedQuestions: string[];
  actionButtons: Array<{ label: string; action: string; params: Record<string, string> }>;
  confidenceLevel: 'high' | 'medium' | 'low';
  lowConfidence: boolean;
}

export interface SearchHistoryEntry {
  _id: string;
  queryMasked: string;
  intent?: string;
  entities: Record<string, unknown>;
  resultCounts: Record<string, number>;
  isSaved: boolean;
  savedLabel?: string;
  createdAt: string;
}

export interface PopularSearchEntry {
  query: string;
  count: number;
  lastIntent: string | null;
}

export interface SearchSuggestions {
  popularColleges: Array<{ id: string; name: string; slug: string }>;
  popularCourses: string[];
  trendingSearches: string[];
  suggestedQueries: string[];
}

export interface SearchFilters {
  city?: string;
  district?: string;
  collegeType?: string;
  branch?: string;
  discipline?: string;
  examCode?: string;
  minFee?: number;
  maxFee?: number;
  maxNirf?: number;
  naac?: string;
  nbaOnly?: boolean;
  aicteApproved?: boolean;
  hostelAvailable?: boolean;
}

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const searchApi = {
  search: (token: string, query: string, filters?: SearchFilters, page = 1, limit = 10) =>
    apiClient.post<SearchResponse>('/search', { query, filters, page, limit }, token),

  voiceSearch: (token: string, transcript: string, filters?: SearchFilters) =>
    apiClient.post<SearchResponse>('/search/voice', { transcript, filters }, token),

  summarize: (token: string, query: string) =>
    apiClient.post<SummarizeResponse>('/search/summarize', { query }, token),

  getHistory: (token: string) =>
    apiClient.get<{ recent: SearchHistoryEntry[]; saved: SearchHistoryEntry[] }>('/search/history', token),

  saveSearch: (token: string, historyId: string, label?: string) =>
    apiClient.post<SearchHistoryEntry>('/search/saved', { historyId, label }, token),

  unsaveSearch: (token: string, historyId: string) =>
    apiClient.del<void>(`/search/saved/${historyId}`, token),

  getPopular: (limit = 10) =>
    apiClient.get<{ popular: PopularSearchEntry[] }>(`/search/popular${buildQuery({ limit })}`),

  getSuggestions: () => apiClient.get<SearchSuggestions>('/search/suggestions'),
};
