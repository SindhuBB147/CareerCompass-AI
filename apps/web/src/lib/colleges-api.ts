// Typed client for the Colleges module — search/detail/compare/facets/cutoffs/reviews.
// Sits on top of the shared apiClient (see lib/api-client.ts) instead of the raw
// fetch() calls the old colleges pages used, so query params and the response
// envelope are handled in one place.

import { apiClient } from './api-client';

export interface Accreditation {
  naac?: string;
  nbaCourses: string[];
  nirfRank?: number;
}

export interface Contact {
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  googleMapQuery?: string;
  admissionPhone?: string;
  admissionEmail?: string;
  placementPhone?: string;
  placementEmail?: string;
}

export interface FeeByQuota {
  academicYear: string | null;
  kcetFee: number | null;
  comedkFee: number | null;
  managementFee: number | null;
}

export interface FeeByAdmissionCode {
  admissionCode: string;
  academicYear: string | null;
  kcetFee: number | null;
  comedkFee: number | null;
  managementFee: number | null;
}

export interface FeeBreakdown {
  tuitionFee: number;
  hostelFee: number;
  messFee: number;
  otherCharges: number;
  totalAnnualFee: number;
  academicYear?: string | null;
  byQuota?: FeeByQuota;
  byAdmissionCode?: FeeByAdmissionCode[];
}

export interface AlternateAdmissionCode {
  code: string;
  examBody: string;
  note: string;
}

export interface HostelInfo {
  boysHostel: boolean;
  girlsHostel: boolean;
  capacity: number;
  roomTypes: string[];
  messDetails: string;
  amenities: string[];
  images: string[];
  hostelFeePerYear?: number | null;
  hostelFeeAcademicYear?: string | null;
}

export interface CollegeCutoff {
  academicYear: string;
  course: string;
  category: string;
  quota: string;
  round: number;
  openingRank: number | null;
  closingRank: number | null;
  admissionCode?: string | null;
}

export interface AdmissionRoute {
  route: string;
  eligibility: string;
  process: string;
}

export interface AboutInfo {
  summary: string;
  history: string;
  vision: string;
  mission: string;
}

export interface CampusInfo {
  description: string;
  architectureHighlights: string[];
  facilities: string[];
}

export interface DataMetadata {
  dataVerified: boolean;
  lastVerified: string | null;
  dataSources: string[];
  dataVersion: string;
}

export type ImageVerificationStatus = 'verified' | 'needs_review' | 'rejected';

export interface GalleryItem {
  id?: string;
  category: 'Campus' | 'Library' | 'Labs' | 'Hostels' | 'Sports' | 'Auditorium' | 'Fest';
  url: string;
  title: string;
  thumbnailUrl?: string | null;
  altText?: string;
  sourceUrl?: string | null;
  sourceName?: string | null;
  verificationStatus?: ImageVerificationStatus;
  isPrimary?: boolean;
  displayOrder?: number;
}

export interface CategorySeatBreakdown {
  cat1_g: number;
  cat1_r: number;
  cat1_k: number;
  cat2a_g: number;
  cat2a_r: number;
  cat2a_k: number;
  cat2b_g: number;
  cat2b_r: number;
  cat2b_k: number;
  cat3a_g: number;
  cat3a_r: number;
  cat3a_k: number;
  cat3b_g: number;
  cat3b_r: number;
  cat3b_k: number;
  st_g: number;
  st_r: number;
  st_k: number;
  sc_g: number;
  sc_r: number;
  sc_k: number;
  gm_g: number;
  gm_r: number;
  gm_k: number;
  total: number;
}

export interface SeatMatrix {
  academicYear?: string | null;
  totalSeats: number;
  kkSeats?: CategorySeatBreakdown | null;
  rkSeats?: CategorySeatBreakdown | null;
  specialQuotaSeats?: Record<string, number>;
}

export interface Course {
  courseId: string;
  name: string;
  degreeType: string;
  durationYears: number;
  intake: number;
  examsAccepted: string[];
  feePerYear: number | null;
  eligibility: string;
  cutoffRankSummary: number | null;
  discipline: string;
  academicYear?: string | null;
  sanctionedIntake?: number | null;
  seatMatrix?: SeatMatrix | null;
}

export interface PlacementEntry {
  year: number;
  highestPackage: number;
  averagePackage: number;
  medianPackage: number;
  placementPercentage: number;
  topRecruiters: string[];
}

export interface AdmissionStep {
  stepNumber: number;
  title: string;
  description: string;
}

export interface StudentReview {
  id: string;
  userName: string;
  userRole: string;
  rating: number;
  academicsRating: number;
  placementRating: number;
  campusRating: number;
  hostelRating: number;
  facultyRating: number;
  comment: string;
  date: string;
  verifiedStudent: boolean;
}

export interface College {
  _id: string;
  id: string;
  collegeId?: string | null;
  slug: string;
  name: string;
  aliasNames: string[];
  alternateAdmissionCodes?: AlternateAdmissionCode[];
  state: string;
  city: string;
  district?: string;
  collegeType: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  establishedYear: number | null;
  aicteApproved: boolean | null;
  rating: number | null;
  reviewsCount: number | null;
  campusSizeAcres: number | null;
  studentCount: number | null;
  facultyCount: number | null;
  bannerImage: string;
  logo: string;
  description: string;
  highlights: string[];
  affiliatedUniversity?: string;
  latitude?: number | null;
  longitude?: number | null;
  status?: 'active' | 'archived';
  archivedAt?: string | null;
  accreditation: Accreditation;
  contact: Contact;
  feeBreakdown: FeeBreakdown;
  hostelInfo: HostelInfo;
  gallery: GalleryItem[];
  courses: Course[];
  placementSummary: PlacementEntry[];
  admissionProcess: AdmissionStep[];
  reviewsList: StudentReview[];
  isVerified: boolean;
  about?: AboutInfo;
  campus?: CampusInfo;
  admissionRoutes?: AdmissionRoute[];
  cutoffs?: CollegeCutoff[];
  metadata?: DataMetadata;
}

export type ExamCode = 'KCET' | 'COMEDK' | 'NEET';

export interface SearchCollegesParams {
  q?: string;
  state?: string;
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
  sortBy?: 'nirf' | 'fees' | 'placement' | 'name' | 'rating';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  page?: number;
  limit?: number;
}

export interface SearchCollegesResult {
  results: College[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface CollegeFacets {
  cities: string[];
  districts: string[];
  collegeTypes: string[];
  naacGrades: string[];
  branches: string[];
  disciplines: string[];
}

export interface CutoffRow {
  _id?: string;
  id?: string;
  collegeId: string;
  courseId: string;
  courseName?: string;
  examCode: string;
  year: number;
  round: number;
  category: string;
  branch?: string;
  closingRank: number;
  source?: string;
  status?: 'verified' | 'needs_review' | 'imported' | 'archived' | 'invalid';
  lastUpdated?: string;
  [key: string]: any; // Support for dynamic extra columns
}

export interface CutoffQueryParams {
  examCode?: string;
  year?: number;
  round?: number;
  courseId?: string;
  category?: string;
  branch?: string;
  search?: string;
  status?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CutoffQueryResult {
  results: CutoffRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CutoffFacetsResult {
  years: number[];
  rounds: number[];
  categories: string[];
  courses: string[];
  branches: string[];
}

export interface CutoffSummaryResult {
  latestAcademicYear: number | null;
  latestRound: number | null;
  lowestClosingRank: number | null;
  highestClosingRank: number | null;
  totalCourses: number;
  totalRecords: number;
  lastUpdated: string | null;
}

export interface CutoffTrendYearSummary {
  year: number;
  round1Closing?: number;
  round2Closing?: number;
  mopUpClosing?: number;
  latestClosing: number;
}

export interface CutoffTrendsResult {
  rows: CutoffRow[];
  yearSummary: CutoffTrendYearSummary[];
}

export interface CutoffAIInsightsResult {
  isAIEstimate: boolean;
  trendDirection: 'tightened' | 'relaxed' | 'stable';
  percentageChange: number;
  summaryText: string;
  predictedRankRange: { min: number; max: number; expected: number } | null;
  admissionProbability: 'high' | 'moderate' | 'low';
  keyInsights: string[];
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

export const collegesApi = {
  search: (params: SearchCollegesParams, signal?: AbortSignal) =>
    apiClient.get<SearchCollegesResult>(`/colleges${buildQuery(params)}`, undefined, signal),

  getDetail: (idOrSlug: string) => apiClient.get<College>(`/colleges/${idOrSlug}`),

  compare: (collegeIds: string[]) =>
    apiClient.post<{ colleges: College[] }>('/colleges/compare', { collegeIds }),

  getFacets: (examCode?: string, signal?: AbortSignal) =>
    apiClient.get<CollegeFacets>(`/colleges/facets${buildQuery({ examCode })}`, undefined, signal),

  getCutoffs: (collegeId: string, params: CutoffQueryParams) =>
    apiClient.get<CutoffQueryResult>(`/colleges/${collegeId}/cutoffs${buildQuery(params)}`),

  getCutoffFacets: (collegeId: string, examCode?: string) =>
    apiClient.get<CutoffFacetsResult>(`/colleges/${collegeId}/cutoffs/facets${buildQuery({ examCode })}`),

  getCutoffSummary: (collegeId: string, examCode?: string, courseId?: string, category?: string) =>
    apiClient.get<CutoffSummaryResult>(`/colleges/${collegeId}/cutoffs/summary${buildQuery({ examCode, courseId, category })}`),

  getCutoffTrends: (collegeId: string, courseId?: string, examCode?: string, category: string = 'GM') =>
    apiClient.get<CutoffTrendsResult>(`/colleges/${collegeId}/cutoffs/trends${buildQuery({ courseId, examCode, category })}`),

  getCutoffAIInsights: (collegeId: string, courseId?: string, examCode?: string, category: string = 'GM') =>
    apiClient.get<CutoffAIInsightsResult>(`/colleges/${collegeId}/cutoffs/insights${buildQuery({ courseId, examCode, category })}`),

  getExamCategories: (examCode: string) =>
    apiClient.get<{ categories: string[] }>(`/cutoffs/categories${buildQuery({ examCode })}`),

  getCutoffPdfUrl: (collegeId: string, params: CutoffQueryParams) => {
    return `/api/v1/colleges/${collegeId}/cutoffs/export/pdf${buildQuery(params)}`;
  },

  getCutoffTrend: (collegeId: string, courseId: string, examCode: string, category: string) =>
    apiClient.get<{ collegeId: string; courseId: string; examCode: string; trend: CutoffRow[] }>(
      `/colleges/${collegeId}/cutoffs/trends${buildQuery({ courseId, examCode, category })}`,
    ),

  addReview: (
    collegeId: string,
    dto: { userName: string; rating: number; comment: string; academicsRating?: number; placementRating?: number; campusRating?: number; hostelRating?: number; facultyRating?: number },
  ) => apiClient.post<StudentReview>(`/colleges/${collegeId}/reviews`, dto),
};
