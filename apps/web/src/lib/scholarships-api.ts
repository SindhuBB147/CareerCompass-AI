// Typed client for the Scholarship module — browse/search/filter, detail,
// eligibility checks, recommendations, and bookmarks. Sits on the shared
// apiClient, mirroring lib/colleges-api.ts's conventions.

import { apiClient } from './api-client';

export interface ScholarshipEligibility {
  categories: string[];
  maxIncome?: number;
  minIncome?: number;
  states: string[];
  exams: string[];
  applicableCourses: string[];
  genderSpecific?: string;
  minorityOnly: boolean;
  pwdOnly: boolean;
  requiredReservations: string[];
  minRank?: number;
  maxRank?: number;
  minAcademicPercent?: number;
  academicCriteriaNote?: string;
}

export interface AwardAmount {
  type: 'fixed' | 'percentage';
  value: number;
  displayText?: string;
}

export interface ApplicationStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface ApplicationLinks {
  officialWebsite?: string;
  applyLink?: string;
  notificationPdf?: string;
  guidelinesPdf?: string;
  helpdeskUrl?: string;
}

export interface ContactInfo {
  email?: string;
  phone?: string;
}

export interface Scholarship {
  _id: string;
  id: string;
  name: string;
  slug?: string;
  provider: 'government' | 'private' | 'institution';
  providerName?: string;
  categories: string[];
  type?: string;
  description?: string;
  benefits: string[];
  eligibility: ScholarshipEligibility;
  awardAmount: AwardAmount;
  documents: string[];
  applicationSteps: ApplicationStep[];
  applicationMode: 'online' | 'offline' | 'both';
  faqs: Faq[];
  links: ApplicationLinks;
  contact: ContactInfo;
  applicationOpensAt?: string;
  applicationDeadline: string;
  renewalPolicy?: string;
  featured: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface ScholarshipCategory {
  _id: string;
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

export interface ScholarshipProvider {
  _id: string;
  id: string;
  name: string;
  type: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
}

export type CheckResult = 'pass' | 'fail' | 'unknown';
export type EligibilityVerdict = 'eligible' | 'partially_eligible' | 'not_eligible';

export interface EligibilityCheck {
  key: string;
  label: string;
  result: CheckResult;
  message: string;
}

export interface EligibilityReport {
  verdict: EligibilityVerdict;
  score: number;
  checks: EligibilityCheck[];
  reasons: { passed: string[]; failed: string[]; unknown: string[] };
}

export type RecommendationTier = 'highly_recommended' | 'recommended' | 'eligible' | 'almost_eligible';

export interface ScholarshipRecommendation {
  scholarship: Scholarship;
  eligibility: EligibilityReport;
  tier: RecommendationTier;
  tierLabel: string;
}

export interface SearchScholarshipsParams {
  q?: string;
  exam?: 'KCET' | 'COMEDK' | 'NEET';
  category?: string;
  provider?: 'government' | 'private' | 'institution';
  reservation?: string;
  income?: number;
  status?: 'open' | 'upcoming' | 'expired' | 'all';
  sortBy?: 'deadline' | 'amount' | 'newest';
  featuredOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface SearchScholarshipsResult {
  scholarships: Scholarship[];
  totalResults: number;
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

export const scholarshipsApi = {
  search: (params: SearchScholarshipsParams) =>
    apiClient.get<SearchScholarshipsResult>(`/scholarships${buildQuery(params)}`),

  getDetail: (idOrSlug: string) => apiClient.get<Scholarship>(`/scholarships/${idOrSlug}`),

  getFeatured: (limit?: number) => apiClient.get<Scholarship[]>(`/scholarships/featured${buildQuery({ limit })}`),

  listCategories: () => apiClient.get<ScholarshipCategory[]>('/scholarships/categories'),
  listProviders: () => apiClient.get<ScholarshipProvider[]>('/scholarships/providers'),

  getRecommended: (token: string, limit?: number) =>
    apiClient.get<{ recommendations: ScholarshipRecommendation[] }>(`/scholarships/recommended${buildQuery({ limit })}`, token),

  checkEligibility: (token: string, scholarshipId: string) =>
    apiClient.get<EligibilityReport>(`/scholarships/${scholarshipId}/eligibility`, token),

  listBookmarks: (token: string) => apiClient.get<{ scholarships: Scholarship[] }>('/scholarships/bookmarks', token),
  addBookmark: (token: string, scholarshipId: string) =>
    apiClient.post<{ bookmarked: boolean }>(`/scholarships/${scholarshipId}/bookmark`, undefined, token),
  removeBookmark: (token: string, scholarshipId: string) =>
    apiClient.del<{ bookmarked: boolean }>(`/scholarships/${scholarshipId}/bookmark`, token),
};
