// Typed client for the Saved Colleges & Wishlist module — save/remove,
// custom lists, notes, bookmark status, compare, AI insights, admission
// tracking, recently viewed, and sharing. Mirrors lib/scholarships-api.ts's
// conventions on the shared apiClient.

import { apiClient } from './api-client';
import type { College } from './colleges-api';

export type BookmarkStatus = 'dream' | 'target' | 'safe' | 'backup' | 'interested' | 'applied' | 'admitted' | 'rejected';
export type WishlistSortBy = 'nirf' | 'fees' | 'placement' | 'roi' | 'admissionProbability' | 'aiScore' | 'name' | 'recentlyAdded';

export interface CollegeNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface CollegeEnrichment {
  admissionProbability: number | null;
  admissionProbabilityBand: string | null;
  roiPercent: number | null;
  paybackYears: number | null;
  placementPercentage: number | null;
  aiRecommendationScore: number;
  scholarshipEligible: boolean;
  scholarshipCount: number;
  budgetFit: boolean | null;
}

export interface SavedCollegeView {
  collegeId: string;
  savedAt: string;
  status: BookmarkStatus;
  notes: CollegeNote[];
  listIds: string[];
  college: College;
  enrichment: CollegeEnrichment;
}

export interface ListSummary {
  id: string;
  key: string | null;
  name: string;
  icon: string;
  type: 'default' | 'custom';
  order: number;
  itemCount: number;
}

export interface WishlistFilters {
  listId?: string;
  status?: BookmarkStatus;
  sortBy?: WishlistSortBy;
  sortOrder?: 'asc' | 'desc';
  examCode?: string;
  collegeType?: string;
  course?: string;
  city?: string;
  district?: string;
  minFee?: number;
  maxFee?: number;
  hostelAvailable?: boolean;
  scholarshipEligible?: boolean;
  minAdmissionProbability?: number;
}

export interface SavedStatus {
  saved: boolean;
  status: BookmarkStatus | null;
  notes: CollegeNote[];
  listIds: string[];
}

export interface AdmissionRoundView {
  roundNumber: number;
  name: string;
  choiceFillingStart: string | null;
  choiceFillingEnd: string | null;
  cutoffReleaseDate: string | null;
  reportingDeadline: string | null;
  status: string;
  isMopUp: boolean;
  isSpot: boolean;
}

export interface AdmissionTrackingView {
  examCode: string | null;
  examName: string | null;
  year: number | null;
  rounds: AdmissionRoundView[];
}

export interface RecentlyViewedItem {
  collegeId: string;
  viewedAt: string;
  college: College;
}

export interface ComparedCollege {
  college: College;
  enrichment: CollegeEnrichment;
}

export interface ComparisonHistoryEntry {
  id: string;
  name: string | null;
  createdAt: string;
  collegeIds: string[];
  collegeNames: string[];
}

export interface WishlistInsight {
  icon: string;
  text: string;
  collegeId?: string;
}

export interface WishlistScoreRow {
  collegeId: string;
  collegeName: string;
  aiRecommendationScore: number;
  admissionProbability: number | null;
  roiPercent: number | null;
  scholarshipEligible: boolean;
  budgetFit: boolean | null;
}

function qs(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const wishlistApi = {
  getWishlist: (filters: WishlistFilters, token: string | null) =>
    apiClient.get<{ lists: ListSummary[]; colleges: SavedCollegeView[] }>(`/wishlist${qs(filters)}`, token),

  getLists: (token: string | null) => apiClient.get<{ lists: ListSummary[] }>('/wishlist/lists', token),
  createList: (name: string, icon: string | undefined, token: string | null) =>
    apiClient.post<ListSummary>('/wishlist/lists', { name, icon }, token),
  renameList: (listId: string, name: string, token: string | null) =>
    apiClient.patch<ListSummary>(`/wishlist/lists/${listId}`, { name }, token),
  deleteList: (listId: string, token: string | null) =>
    apiClient.del<{ deleted: boolean }>(`/wishlist/lists/${listId}`, token),
  duplicateList: (listId: string, token: string | null) =>
    apiClient.post<ListSummary>(`/wishlist/lists/${listId}/duplicate`, undefined, token),
  addToList: (listId: string, collegeId: string, token: string | null) =>
    apiClient.post<{ added: boolean }>(`/wishlist/lists/${listId}/colleges/${collegeId}`, undefined, token),
  removeFromList: (listId: string, collegeId: string, token: string | null) =>
    apiClient.del<{ removed: boolean }>(`/wishlist/lists/${listId}/colleges/${collegeId}`, token),

  getSavedStatus: (collegeId: string, token: string | null) =>
    apiClient.get<SavedStatus>(`/wishlist/colleges/${collegeId}`, token),
  save: (collegeId: string, opts: { listId?: string; status?: BookmarkStatus } | undefined, token: string | null) =>
    apiClient.post<{ saved: boolean }>(`/wishlist/colleges/${collegeId}`, opts, token),
  remove: (collegeId: string, token: string | null) =>
    apiClient.del<{ saved: boolean }>(`/wishlist/colleges/${collegeId}`, token),
  setStatus: (collegeId: string, status: BookmarkStatus, token: string | null) =>
    apiClient.patch<{ status: BookmarkStatus }>(`/wishlist/colleges/${collegeId}/status`, { status }, token),
  move: (collegeId: string, fromListId: string, toListId: string, token: string | null) =>
    apiClient.post<{ moved: boolean }>(`/wishlist/colleges/${collegeId}/move`, { fromListId, toListId }, token),
  addNote: (collegeId: string, text: string, token: string | null) =>
    apiClient.post<CollegeNote>(`/wishlist/colleges/${collegeId}/notes`, { text }, token),
  removeNote: (collegeId: string, noteId: string, token: string | null) =>
    apiClient.del<{ removed: boolean }>(`/wishlist/colleges/${collegeId}/notes/${noteId}`, token),
  getAdmissionTracking: (collegeId: string, token: string | null) =>
    apiClient.get<AdmissionTrackingView>(`/wishlist/colleges/${collegeId}/admission-tracking`, token),

  getRecentlyViewed: (token: string | null) =>
    apiClient.get<{ items: RecentlyViewedItem[] }>('/wishlist/recently-viewed', token),
  recordView: (collegeId: string, token: string | null) =>
    apiClient.post<{ recorded: boolean }>(`/wishlist/recently-viewed/${collegeId}`, undefined, token),
  clearRecentlyViewed: (token: string | null) =>
    apiClient.del<{ cleared: boolean }>('/wishlist/recently-viewed', token),

  compare: (collegeIds: string[], name: string | undefined, token: string | null) =>
    apiClient.post<{ colleges: ComparedCollege[] }>('/wishlist/compare', { collegeIds, name }, token),
  compareHistory: (token: string | null) =>
    apiClient.get<{ history: ComparisonHistoryEntry[] }>('/wishlist/compare/history', token),

  getInsights: (token: string | null) =>
    apiClient.get<{ insights: WishlistInsight[]; scores: WishlistScoreRow[] }>('/wishlist/insights', token),

  createShare: (dto: { kind: 'wishlist' | 'list' | 'comparison'; collegeIds?: string[]; listId?: string }, token: string | null) =>
    apiClient.post<{ token: string }>('/wishlist/share', dto, token),
  getShared: (shareToken: string) =>
    apiClient.get<{ kind: string; createdAt: string; colleges: College[] }>(`/wishlist/shared/${shareToken}`),
};
