// Typed client for every Admin Portal backend surface. Thin wrappers over
// the shared apiClient — every call takes the admin JWT explicitly since
// admin pages read it from AdminAuthContext rather than a global store.

import { apiClient } from './api-client';
import type { College, Course, GalleryItem, ImageVerificationStatus, PlacementEntry, SearchCollegesResult, SearchCollegesParams, SeatMatrix } from './colleges-api';

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

// ── Colleges ──────────────────────────────────────────────────────────────────

export interface CreateCollegeInput {
  collegeId?: string;
  name: string;
  state: string;
  city?: string;
  district?: string;
  collegeType?: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  establishedYear?: number;
  aicteApproved?: boolean;
  bannerImage?: string;
  logo?: string;
  description?: string;
  highlights?: string[];
  latitude?: number;
  longitude?: number;
  accreditation?: { naac?: string; nbaCourses?: string[]; nirfRank?: number };
  contact?: { website?: string; email?: string; phone?: string; address?: string };
  feeBreakdown?: { tuitionFee?: number; hostelFee?: number; messFee?: number; otherCharges?: number; totalAnnualFee?: number; academicYear?: string };
  hostelInfo?: {
    boysHostel?: boolean; girlsHostel?: boolean; capacity?: number; messDetails?: string; amenities?: string[];
    roomTypes?: string[]; hostelFeePerYear?: number; hostelFeeAcademicYear?: string;
  };
  campus?: { description?: string; architectureHighlights?: string[]; facilities?: string[] };
  admissionRoutes?: Array<{ route: string; eligibility?: string; process?: string }>;
}

export const adminCollegesApi = {
  search: (token: string, params: SearchCollegesParams) =>
    apiClient.get<SearchCollegesResult>(`/colleges${buildQuery(params)}`, token),
  create: (token: string, dto: CreateCollegeInput) => apiClient.post<College>('/admin/colleges', dto, token),
  update: (token: string, id: string, dto: Partial<CreateCollegeInput> & { isVerified?: boolean }) =>
    apiClient.patch<College>(`/admin/colleges/${id}`, dto, token),
  // "delete" archives server-side (soft-delete) — courses/seats/cutoffs/images
  // stay attached, the college just drops out of default search/public listing.
  // Guarded by @RequireReauth() — pass a reauthToken from adminSecurityApi.reauth()
  // once the caller has one; omit it to let the 401 REAUTH_REQUIRED surface first.
  archive: (token: string, id: string, reauthToken?: string) =>
    apiClient.del<{ archived: boolean }>(`/admin/colleges/${id}`, token, reauthToken),
  restore: (token: string, id: string) => apiClient.post<College>(`/admin/colleges/${id}/restore`, undefined, token),

  addCourse: (token: string, collegeId: string, dto: Partial<Course> & { courseId: string; name: string; degreeType: string; intake: number; examsAccepted: string[] }) =>
    apiClient.post<Course>(`/admin/colleges/${collegeId}/courses`, dto, token),
  updateCourse: (token: string, collegeId: string, courseId: string, dto: Partial<Course>) =>
    apiClient.patch<Course>(`/admin/colleges/${collegeId}/courses/${courseId}`, dto, token),
  removeCourse: (token: string, collegeId: string, courseId: string) =>
    apiClient.del<{ deleted: boolean }>(`/admin/colleges/${collegeId}/courses/${courseId}`, token),
  updateCourseFee: (token: string, collegeId: string, courseId: string, feePerYear: number) =>
    apiClient.patch<Course>(`/admin/colleges/${collegeId}/courses/${courseId}/fee`, { feePerYear }, token),
  updateSeatMatrix: (token: string, collegeId: string, courseId: string, dto: SeatMatrix) =>
    apiClient.patch<Course>(`/admin/colleges/${collegeId}/courses/${courseId}/seat-matrix`, dto, token),

  addPlacement: (token: string, collegeId: string, dto: PlacementEntry) =>
    apiClient.post<PlacementEntry>(`/admin/colleges/${collegeId}/placement`, dto, token),
  updatePlacement: (token: string, collegeId: string, year: number, dto: Partial<PlacementEntry>) =>
    apiClient.patch<PlacementEntry>(`/admin/colleges/${collegeId}/placement/${year}`, dto, token),

  // ── Images / Gallery ────────────────────────────────────────────────────────
  addImage: (token: string, collegeId: string, dto: AddImageInput) =>
    apiClient.post<GalleryItem>(`/admin/colleges/${collegeId}/images`, dto, token),
  updateImage: (token: string, collegeId: string, imageId: string, dto: Partial<AddImageInput>) =>
    apiClient.patch<GalleryItem>(`/admin/colleges/${collegeId}/images/${imageId}`, dto, token),
  removeImage: (token: string, collegeId: string, imageId: string) =>
    apiClient.del<{ deleted: boolean }>(`/admin/colleges/${collegeId}/images/${imageId}`, token),
  setPrimaryImage: (token: string, collegeId: string, imageId: string) =>
    apiClient.post<GalleryItem>(`/admin/colleges/${collegeId}/images/${imageId}/primary`, undefined, token),
  verifyImage: (token: string, collegeId: string, imageId: string) =>
    apiClient.post<GalleryItem>(`/admin/colleges/${collegeId}/images/${imageId}/verify`, undefined, token),
  rejectImage: (token: string, collegeId: string, imageId: string) =>
    apiClient.post<GalleryItem>(`/admin/colleges/${collegeId}/images/${imageId}/reject`, undefined, token),
  reorderImages: (token: string, collegeId: string, orderedIds: string[]) =>
    apiClient.patch<GalleryItem[]>(`/admin/colleges/${collegeId}/images/reorder`, { orderedIds }, token),
  importImages: (token: string) =>
    apiClient.post<{ totalProcessed: number; updatedCount: number; skippedCount: number; missingCount: number }>('/admin/colleges/import/images', undefined, token),
};

export interface AddImageInput {
  category: GalleryItem['category'];
  url: string;
  title: string;
  thumbnailUrl?: string;
  altText?: string;
  sourceUrl?: string;
  sourceName?: string;
  verificationStatus?: ImageVerificationStatus;
  setPrimary?: boolean;
}

// ── Cutoffs ───────────────────────────────────────────────────────────────────

export interface BulkCutoffRow {
  collegeId: string; courseId: string; courseName?: string; examCode: string; year: number; round: number; category: string;
  branch?: string; closingRank: number;
  status?: 'verified' | 'needs_review' | 'imported' | 'archived' | 'invalid';
}

export type RejectReasonCode = 'missing_fields' | 'unmatched_exam' | 'unmatched_college' | 'unmatched_course' | 'archived_conflict' | 'other';

export interface BulkUploadReport {
  importId: string;
  totalRows: number; accepted: number; rejected: number; conflictsCreated: number;
  rejectedRows: Array<{ row: number; reason: string; reasonCode: RejectReasonCode }>;
}

export type RowPreviewStatus = 'valid' | 'needs_review' | 'invalid' | 'unmatched_college' | 'unmatched_course';

export interface RowPreview {
  row: number;
  status: RowPreviewStatus;
  collegeId?: string;
  collegeName?: string;
  courseId?: string;
  courseName?: string;
  examCode?: string;
  year?: number;
  round?: number;
  category?: string;
  closingRank?: number;
  action?: 'create' | 'update' | 'conflict';
  reason?: string;
  reasonCode?: RejectReasonCode;
}

export interface ValidateRowsResult {
  summary: Record<RowPreviewStatus, number> & { total: number };
  rows: RowPreview[];
}

export interface ParsedFileResult {
  headers: string[];
  rows: Record<string, string>[];
}

export interface CutoffImportLog {
  importId: string; fileName: string; totalRows: number; insertedCount: number; updatedCount: number; failedCount: number;
  errorLog: string[]; status: 'completed' | 'failed' | 'rolled_back'; uploadedBy: string; createdAt: string; affectedCutoffIds?: string[];
}

export interface CutoffConflict {
  _id: string; id: string; collegeId: string; courseId: string; examCode: string; category: string;
  year: number; round: number; field: string; existingValue: number; incomingValue: number;
  status: 'open' | 'resolved'; resolvedValue?: number; resolvedBy?: string; createdAt: string;
}

export type CutoffStatus = 'verified' | 'needs_review' | 'imported' | 'archived' | 'invalid';

export interface CutoffDashboardStats {
  totalRecords: number;
  totalCollegesWithCutoffs: number;
  totalCoursesWithCutoffs: number;
  kcetRecords: number;
  comedkRecords: number;
  neetRecords: number;
  otherExamRecords: number;
  latestAcademicYear: number | null;
  latestImport: { importId: string; fileName: string; uploadedBy: string; createdAt: string } | null;
  recordsRequiringReview: number;
  reviewSample: Array<{
    id: string; collegeId: string; collegeName: string; courseId: string; courseName?: string;
    examCode: string; year: number; category: string; closingRank: number;
  }>;
}

export const adminCutoffsApi = {
  parseFile: (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.postForm<ParsedFileResult>('/admin/cutoffs/parse-file', form, token);
  },
  validateRows: (token: string, rows: BulkCutoffRow[]) =>
    apiClient.post<ValidateRowsResult>('/admin/cutoffs/bulk-upload/validate', { rows }, token),
  bulkUpload: (token: string, rows: BulkCutoffRow[], fileName?: string, overwriteExisting = true) =>
    apiClient.post<BulkUploadReport>('/admin/cutoffs/bulk-upload', { rows, fileName, overwriteExisting }, token),
  importFile: (token: string, rows: BulkCutoffRow[], fileName?: string, overwriteExisting = true) =>
    apiClient.post<BulkUploadReport>('/admin/cutoffs/import', { rows, fileName, overwriteExisting }, token),
  listImports: (token: string) =>
    apiClient.get<{ imports: CutoffImportLog[] }>('/admin/cutoffs/imports', token),
  rollbackImport: (token: string, importId: string) =>
    apiClient.post<{ success: boolean; importId: string; rolledBackCount: number }>(`/admin/cutoffs/imports/${importId}/rollback`, undefined, token),
  listConflicts: (token: string) => apiClient.get<{ conflicts: CutoffConflict[] } | CutoffConflict[]>('/admin/cutoffs/conflicts', token),
  resolveConflict: (token: string, conflictId: string, resolvedValue: number) =>
    apiClient.patch<{ conflictId: string; status: string }>(`/admin/cutoffs/conflicts/${conflictId}/resolve`, { resolvedValue }, token),
  create: (token: string, row: BulkCutoffRow) =>
    apiClient.post<BulkCutoffRow>('/admin/cutoffs', row, token),
  update: (token: string, id: string, dto: Partial<BulkCutoffRow>) =>
    apiClient.put<BulkCutoffRow>(`/admin/cutoffs/${id}`, dto, token),
  delete: (token: string, id: string) =>
    apiClient.del<{ success: boolean; id: string }>(`/admin/cutoffs/${id}`, token),
  bulkDelete: (token: string, ids: string[]) =>
    apiClient.post<{ success: boolean; deletedCount: number }>('/admin/cutoffs/bulk-delete', { ids }, token),
  setStatus: (token: string, id: string, status: CutoffStatus) =>
    apiClient.patch<BulkCutoffRow>(`/admin/cutoffs/${id}/status`, { status }, token),
  getDashboard: (token: string) =>
    apiClient.get<CutoffDashboardStats>('/admin/cutoffs/dashboard', token),
};

// ── Scholarships ──────────────────────────────────────────────────────────────

import type {
  Scholarship, ScholarshipEligibility, AwardAmount, ApplicationStep, Faq, ApplicationLinks, ContactInfo,
  ScholarshipCategory, ScholarshipProvider,
} from './scholarships-api';
export type { Scholarship, ScholarshipCategory, ScholarshipProvider };

export interface CreateScholarshipInput {
  name: string;
  provider: 'government' | 'private' | 'institution';
  providerName?: string;
  categories?: string[];
  type?: string;
  description?: string;
  benefits?: string[];
  eligibility: ScholarshipEligibility;
  awardAmount: AwardAmount;
  documents?: string[];
  applicationSteps?: ApplicationStep[];
  applicationMode?: 'online' | 'offline' | 'both';
  faqs?: Faq[];
  links?: ApplicationLinks;
  contact?: ContactInfo;
  applicationOpensAt?: string;
  applicationDeadline: string;
  renewalPolicy?: string;
  featured?: boolean;
}

export const adminScholarshipsApi = {
  list: (token: string, params: { q?: string; isActive?: boolean; exam?: string; category?: string; page?: number; limit?: number }) =>
    apiClient.get<{ scholarships: Scholarship[]; totalResults: number }>(`/admin/scholarships${buildQuery(params)}`, token),
  detail: (token: string, id: string) => apiClient.get<Scholarship>(`/admin/scholarships/${id}`, token),
  create: (token: string, dto: CreateScholarshipInput) => apiClient.post<Scholarship>('/admin/scholarships', dto, token),
  update: (token: string, id: string, dto: Partial<CreateScholarshipInput> & { isActive?: boolean }) =>
    apiClient.patch<Scholarship>(`/admin/scholarships/${id}`, dto, token),
  remove: (token: string, id: string) => apiClient.del<{ deleted: boolean }>(`/admin/scholarships/${id}`, token),
  notifyDeadline: (token: string, id: string) => apiClient.post<{ notified: number }>(`/admin/scholarships/${id}/notify-deadline`, undefined, token),
};

export interface CreateCategoryInput { slug: string; name: string; description?: string; icon?: string; sortOrder?: number }
export const adminScholarshipCategoriesApi = {
  list: (token: string) => apiClient.get<ScholarshipCategory[]>('/admin/scholarship-categories', token),
  create: (token: string, dto: CreateCategoryInput) => apiClient.post<ScholarshipCategory>('/admin/scholarship-categories', dto, token),
  update: (token: string, id: string, dto: Partial<CreateCategoryInput>) =>
    apiClient.patch<ScholarshipCategory>(`/admin/scholarship-categories/${id}`, dto, token),
  remove: (token: string, id: string) => apiClient.del<{ deleted: boolean }>(`/admin/scholarship-categories/${id}`, token),
};

export interface CreateProviderInput { name: string; type: string; website?: string; contactEmail?: string; contactPhone?: string; description?: string }
export const adminScholarshipProvidersApi = {
  list: (token: string) => apiClient.get<ScholarshipProvider[]>('/admin/scholarship-providers', token),
  create: (token: string, dto: CreateProviderInput) => apiClient.post<ScholarshipProvider>('/admin/scholarship-providers', dto, token),
  update: (token: string, id: string, dto: Partial<CreateProviderInput>) =>
    apiClient.patch<ScholarshipProvider>(`/admin/scholarship-providers/${id}`, dto, token),
  remove: (token: string, id: string) => apiClient.del<{ deleted: boolean }>(`/admin/scholarship-providers/${id}`, token),
};

// ── Students (Users) ─────────────────────────────────────────────────────────

export interface AdminUserSummary {
  _id: string; id: string; fullName: string; phone?: string; email?: string;
  accountStatus: 'active' | 'suspended' | 'deleted'; category?: string; domicileState?: string;
  examProfiles: Array<{ examCode: string; year: number; rank?: number; status: string }>;
  createdAt: string;
}

export const adminStudentsApi = {
  search: (token: string, params: { phone?: string; email?: string; accountStatus?: string; page?: number; limit?: number }) =>
    apiClient.get<{ users: AdminUserSummary[]; totalResults: number }>(`/admin/users${buildQuery(params)}`, token),
  updateStatus: (token: string, userId: string, accountStatus: string, reason: string) =>
    apiClient.patch<{ userId: string; accountStatus: string }>(`/admin/users/${userId}/status`, { accountStatus, reason }, token),
};

// ── Admin accounts (Roles & Permissions) ────────────────────────────────────

export type AdminRole =
  | 'super_admin' | 'data_manager' | 'support_agent' | 'b2b_account_manager'
  | 'counsellor' | 'moderator' | 'data_entry_operator' | 'content_manager' | 'ai_manager';

export interface AdminAccount {
  _id: string; id: string; name: string; email: string; role: AdminRole;
  permissions: string[]; isActive: boolean; lastLoginAt: string | null; createdAt: string;
}

export const adminAccountsApi = {
  list: (token: string, params: { role?: AdminRole; isActive?: boolean; q?: string; page?: number; limit?: number }) =>
    apiClient.get<{ admins: AdminAccount[]; totalResults: number }>(`/admin/admins${buildQuery(params)}`, token),
  listPermissions: (token: string) => apiClient.get<{ permissions: string[]; roles: AdminRole[] }>('/admin/admins/permissions', token),
  create: (token: string, dto: { name: string; email: string; password: string; role: AdminRole; permissions?: string[] }) =>
    apiClient.post<AdminAccount>('/admin/admins', dto, token),
  update: (token: string, id: string, dto: { name?: string; role?: AdminRole; permissions?: string[]; isActive?: boolean }) =>
    apiClient.patch<AdminAccount>(`/admin/admins/${id}`, dto, token),
  resetPassword: (token: string, id: string) =>
    apiClient.post<{ temporaryPassword: string }>(`/admin/admins/${id}/reset-password`, undefined, token),
  remove: (token: string, id: string) => apiClient.del<{ deleted: boolean }>(`/admin/admins/${id}`, token),
};

// ── Audit Logs ───────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  _id: string; id: string; adminId: string; action: string; targetCollection: string; targetId: string;
  beforeSnapshot: unknown; afterSnapshot: unknown; timestamp: string; ipAddress: string | null;
}

export const adminAuditLogsApi = {
  list: (token: string, params: { targetCollection?: string; targetId?: string; adminId?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    apiClient.get<{ logs: AuditLogEntry[]; totalResults: number }>(`/admin/audit-logs${buildQuery(params)}`, token),
};

// ── Security Module (Admin Security Management) ────────────────────────────

export interface LoginHistoryRow {
  _id: string; id: string; userId: string; actorType: 'student' | 'admin'; timestamp: string;
  ip?: string; browser?: string; os?: string; deviceName?: string; loginMethod: string;
  status: 'success' | 'failed' | 'blocked'; failureReason?: string; reportedAsUnknown: boolean;
}

export interface SecurityEventRow {
  _id: string; id: string; actorId: string; actorType: string; actorEmail?: string; action: string;
  result: 'success' | 'failure'; ip?: string; userAgent?: string; timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ActiveSessionRow {
  userId: string; fullName?: string; email?: string;
  session: { sessionId: string; userAgent?: string; ip?: string; createdAt: string; lastUsedAt: string };
}

export interface SecurityAnalytics {
  loginTrends: Array<{ _id: { day: string; status: string }; count: number }>;
  browserDistribution: Array<{ _id: string; count: number }>;
  osDistribution: Array<{ _id: string; count: number }>;
}

export const adminSecurityApi = {
  // Step-up auth for @RequireReauth()-guarded actions (archive college, delete
  // admin, force-disable a user, …). Returns a short-lived reauthToken to pass
  // as the extra arg on the guarded call.
  reauth: (token: string, currentPassword: string) =>
    apiClient.post<{ reauthToken: string }>('/security/reauth', { currentPassword }, token),
  failedLogins: (token: string, page = 1, limit = 50) =>
    apiClient.get<{ entries: LoginHistoryRow[]; totalResults: number }>(`/admin/security/failed-logins${buildQuery({ page, limit })}`, token),
  suspiciousLogins: (token: string, page = 1, limit = 50) =>
    apiClient.get<{ entries: LoginHistoryRow[]; totalResults: number }>(`/admin/security/suspicious-logins${buildQuery({ page, limit })}`, token),
  lockedAccounts: (token: string, page = 1, limit = 50) =>
    apiClient.get<{ students: any[]; studentTotal: number; admins: any[]; adminTotal: number }>(`/admin/security/locked-accounts${buildQuery({ page, limit })}`, token),
  activeSessions: (token: string, page = 1, limit = 50) =>
    apiClient.get<{ students: ActiveSessionRow[]; studentTotal: number; admins: ActiveSessionRow[]; adminTotal: number }>(`/admin/security/active-sessions${buildQuery({ page, limit })}`, token),
  events: (token: string, page = 1, limit = 50) =>
    apiClient.get<{ events: SecurityEventRow[]; totalResults: number }>(`/admin/security/events${buildQuery({ page, limit })}`, token),
  analytics: (token: string, days = 30) =>
    apiClient.get<SecurityAnalytics>(`/admin/security/analytics${buildQuery({ days })}`, token),
  forceLogout: (token: string, userId: string, actorType: 'student' | 'admin') =>
    apiClient.post<{ loggedOut: boolean }>(`/admin/security/force-logout/${userId}`, { actorType }, token),
  unlock: (token: string, userId: string, actorType: 'student' | 'admin') =>
    apiClient.post<{ unlocked: boolean }>(`/admin/security/unlock/${userId}`, { actorType }, token),
  disable: (token: string, userId: string, actorType: 'student' | 'admin', reason?: string) =>
    apiClient.post<{ disabled: boolean }>(`/admin/security/disable/${userId}`, { actorType, reason }, token),
};

// ── Analytics / Reports ──────────────────────────────────────────────────────

export interface DashboardMetrics {
  totalStudents: number; activeStudents30d: number; newRegistrations7d: number;
  totalColleges: number; totalCourses: number; kcetColleges: number; comedkColleges: number; neetColleges: number;
  totalScholarships: number; totalPredictions: number; aiCounsellorSessions: number; aiCounsellorEngagementRate: number;
  pendingCutoffConflicts: number; flaggedAiConversations: number; predictionAccuracy: number | null;
  topExams: Array<{ examCode: string; count: number }>;
  registrationTrend: Array<{ date: string; count: number }>;
  predictionTrend: Array<{ date: string; count: number }>;
  aiUsageTrend: Array<{ date: string; count: number }>;
  popularCourses: Array<{ courseId: string; count: number }>;
  popularColleges: Array<{ collegeId: string; name: string; count: number }>;
}

export const adminAnalyticsApi = {
  dashboard: (token: string, params?: { from?: string; to?: string }) =>
    apiClient.get<DashboardMetrics>(`/admin/analytics/dashboard${buildQuery(params ?? {})}`, token),
};

export interface PlatformReport {
  generatedAt: string;
  period: { from: string; to: string };
  userMetrics: { totalRegistered: number; activeInPeriod: number; newRegistrations: number; byExam: Array<{ examCode: string; count: number }>; byCategory: Array<{ category: string; count: number }> };
  predictionMetrics: { totalComputed: number; bandDistribution: Array<{ band: string; count: number }> };
  notificationMetrics: { totalSent: number; deliverySuccessRate: number; byChannel: Array<{ channel: string; count: number }> };
  cutoffMetrics: { totalRecords: number; byExam: Array<{ examCode: string; count: number }>; conflictsOpen: number; conflictsResolved: number };
}

export const adminReportsApi = {
  platform: (token: string, params?: { from?: string; to?: string }) =>
    apiClient.get<PlatformReport>(`/admin/reports/platform${buildQuery(params ?? {})}`, token),
  cohort: (token: string, examCode: string) =>
    apiClient.get<{ examCode: string; totalStudents: number; rankDistribution: Array<{ bucket: string; count: number }>; topShortlistedColleges: unknown[] }>(`/admin/reports/cohort${buildQuery({ examCode })}`, token),
};

// ── Saved Colleges & Wishlist Analytics ─────────────────────────────────────

export interface WishlistAnalytics {
  mostSaved: Array<{ collegeId: string; collegeName: string; saves: number }>;
  trending: Array<{ collegeId: string; collegeName: string; savesLast7Days: number }>;
  mostCompared: Array<{ collegeId: string; collegeName: string; comparisons: number }>;
  popularLists: Array<{ name: string; count: number }>;
  bookmarkStatusBreakdown: Array<{ status: string; count: number }>;
}

export interface AdminSavedCollegeRow {
  id: string;
  userId: string;
  studentName: string;
  studentEmail: string | null;
  collegeId: string;
  collegeName: string;
  collegeCode: string | null;
  city: string | null;
  district: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSavedCollegeListParams {
  q?: string;
  status?: string;
  state?: string;
  district?: string;
  collegeType?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'newest' | 'oldest' | 'college_asc' | 'college_desc' | 'student_asc' | 'student_desc';
  page?: number;
  limit?: number;
}

export interface AdminSavedCollegeListResult {
  records: AdminSavedCollegeRow[];
  totalResults: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const adminWishlistApi = {
  analytics: (token: string) => apiClient.get<WishlistAnalytics>('/admin/wishlist/analytics', token),
  list: (token: string, params: AdminSavedCollegeListParams) =>
    apiClient.get<AdminSavedCollegeListResult>(`/admin/wishlist${buildQuery(params)}`, token),
  remove: (token: string, userId: string, collegeId: string) =>
    apiClient.del<{ success: boolean; userId: string; collegeId: string }>(`/admin/wishlist/${userId}/${collegeId}`, token),
};

// ── Career Roadmap Templates ────────────────────────────────────────────────

export interface CareerTemplateRecord {
  _id: string;
  careerId: string;
  name: string;
  category: import('./roadmap-api').CareerCategory;
  description: string;
  tags: string[];
  phases: unknown[];
  isActive: boolean;
}

export interface CareerTemplateInput {
  careerId: string;
  name: string;
  category: string;
  description: string;
  tags?: string[];
  phases?: unknown[];
  isActive?: boolean;
}

export const adminRoadmapTemplatesApi = {
  list: (token: string, page = 1, limit = 50) =>
    apiClient.get<{ templates: CareerTemplateRecord[]; total: number }>(`/admin/roadmap-templates${buildQuery({ page, limit })}`, token),
  detail: (token: string, careerId: string) => apiClient.get<CareerTemplateRecord>(`/admin/roadmap-templates/${careerId}`, token),
  create: (token: string, dto: CareerTemplateInput) => apiClient.post<CareerTemplateRecord>('/admin/roadmap-templates', dto, token),
  update: (token: string, careerId: string, dto: Partial<CareerTemplateInput>) =>
    apiClient.patch<CareerTemplateRecord>(`/admin/roadmap-templates/${careerId}`, dto, token),
  remove: (token: string, careerId: string) => apiClient.del<{ deleted: boolean }>(`/admin/roadmap-templates/${careerId}`, token),
};

// ── AI Counsellor: prompt templates + live LLM provider switch ──────────────

export interface PromptTemplateRecord {
  id: string;
  name: string;
  version: number;
  system_prompt: string;
  is_active: boolean;
  created_at: string;
}

export const adminPromptTemplatesApi = {
  list: (token: string) =>
    apiClient.get<{ templates: PromptTemplateRecord[] }>('/admin/ai-counsellor/prompt-templates', token),
  create: (token: string, name: string, systemPrompt: string) =>
    apiClient.post<PromptTemplateRecord>('/admin/ai-counsellor/prompt-templates', { name, systemPrompt }, token),
  update: (token: string, templateId: string, systemPrompt: string) =>
    apiClient.patch<PromptTemplateRecord>(`/admin/ai-counsellor/prompt-templates/${templateId}`, { systemPrompt }, token),
  activate: (token: string, templateId: string) =>
    apiClient.post<PromptTemplateRecord>(`/admin/ai-counsellor/prompt-templates/${templateId}/activate`, undefined, token),
  remove: (token: string, templateId: string) =>
    apiClient.del<{ deleted: boolean }>(`/admin/ai-counsellor/prompt-templates/${templateId}`, token),
};

export interface LlmProviderSettings {
  configured_providers: string[];
  active_override: string | null;
  effective_provider: string;
}

export const adminLlmProviderApi = {
  get: (token: string) => apiClient.get<LlmProviderSettings>('/admin/ai-counsellor/llm-provider', token),
  set: (token: string, provider: string) =>
    apiClient.put<LlmProviderSettings>('/admin/ai-counsellor/llm-provider', { provider }, token),
};

// ── Knowledge Base (RAG pipeline document management) ──────────────────────

export interface KnowledgeDocument {
  id: string;
  title: string;
  doc_type: string;
  status: string;
  chunk_count: number;
  embedding_model: string | null;
  source_filename: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeUsageSummary {
  totalRequests: number;
  avgConfidence: number | null;
  avgLatencyMs: number | null;
  lowConfidenceRate: number;
  erroredRate: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCostUsd: number;
  avgCostPerRequest: number;
  byIntent: Array<{ intent: string; count: number }>;
}

export interface KnowledgeCategory {
  code: string;
  label: string;
  description: string | null;
}

export interface KnowledgeChunkSummary {
  chunk_id: string;
  chunk_index: number;
  snippet: string;
  page_number: number | null;
  page_range: string | null;
}

export const adminKnowledgeApi = {
  status: (token: string) =>
    apiClient.get<{ documents: KnowledgeDocument[]; total_chunks: number }>('/admin/ai-counsellor/knowledge/status', token),
  usage: (token: string) => apiClient.get<KnowledgeUsageSummary>('/admin/ai-counsellor/usage', token),
  categories: (token: string) =>
    apiClient.get<{ categories: KnowledgeCategory[] }>('/admin/ai-counsellor/knowledge/categories', token),
  chunks: (token: string, documentId: string) =>
    apiClient.get<{ document_id: string; chunks: KnowledgeChunkSummary[] }>(`/admin/ai-counsellor/knowledge/${documentId}/chunks`, token),
  upload: (token: string, file: File, docType: string, title?: string) => {
    const form = new FormData();
    form.append('file', file);
    const params = new URLSearchParams({ docType });
    if (title?.trim()) params.set('title', title.trim());
    return apiClient.postForm<{ title: string; status: string; chunk_count: number; reused_existing: boolean }>(
      `/admin/ai-counsellor/knowledge/upload?${params.toString()}`, form, token,
    );
  },
  reindex: (token: string, documentId?: string) =>
    apiClient.post(`/admin/ai-counsellor/knowledge/reindex${documentId ? `?documentId=${documentId}` : ''}`, undefined, token),
  remove: (token: string, documentId: string) =>
    apiClient.del<{ documentId: string; deleted: boolean }>(`/admin/ai-counsellor/knowledge/${documentId}`, token),
};
