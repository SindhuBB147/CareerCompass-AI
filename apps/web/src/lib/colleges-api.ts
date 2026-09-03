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
}

export interface FeeBreakdown {
  tuitionFee: number;
  hostelFee: number;
  messFee: number;
  otherCharges: number;
  totalAnnualFee: number;
}

export interface HostelInfo {
  boysHostel: boolean;
  girlsHostel: boolean;
  capacity: number;
  roomTypes: string[];
  messDetails: string;
  amenities: string[];
  images: string[];
}

export interface GalleryItem {
  category: 'Campus' | 'Library' | 'Labs' | 'Hostels' | 'Sports' | 'Auditorium' | 'Fest';
  url: string;
  title: string;
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
  slug: string;
  name: string;
  aliasNames: string[];
  state: string;
  city: string;
  district?: string;
  collegeType: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  establishedYear: number;
  aicteApproved: boolean;
  rating: number;
  reviewsCount: number;
  campusSizeAcres: number;
  studentCount: number;
  facultyCount: number;
  bannerImage: string;
  logo: string;
  description: string;
  highlights: string[];
  affiliatedUniversity?: string;
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
  collegeId: string;
  courseId: string;
  examCode: string;
  year: number;
  round: number;
  category: string;
  openingRank?: number;
  closingRank: number;
  seatsAvailable?: number;
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
  search: (params: SearchCollegesParams) =>
    apiClient.get<SearchCollegesResult>(`/colleges${buildQuery(params)}`),

  getDetail: (idOrSlug: string) => apiClient.get<College>(`/colleges/${idOrSlug}`),

  compare: (collegeIds: string[]) =>
    apiClient.post<{ colleges: College[] }>('/colleges/compare', { collegeIds }),

  getFacets: (examCode?: string) =>
    apiClient.get<CollegeFacets>(`/colleges/facets${buildQuery({ examCode })}`),

  getCutoffTrend: (collegeId: string, courseId: string, examCode: string, category: string) =>
    apiClient.get<{ collegeId: string; courseId: string; examCode: string; trend: CutoffRow[] }>(
      `/colleges/${collegeId}/cutoffs${buildQuery({ courseId, examCode, category })}`,
    ),

  addReview: (
    collegeId: string,
    dto: { userName: string; rating: number; comment: string; academicsRating?: number; placementRating?: number; campusRating?: number; hostelRating?: number; facultyRating?: number },
  ) => apiClient.post<StudentReview>(`/colleges/${collegeId}/reviews`, dto),
};
