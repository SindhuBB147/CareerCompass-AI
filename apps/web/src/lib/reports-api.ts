// Typed client for the Reports & Export module. Mirrors roadmap-api.ts's
// conventions (thin apiClient wrappers, types re-declared here rather than
// shared with the backend) plus one new pattern: downloadAuthenticated(),
// since apiClient's request() only understands the {success,data} JSON
// envelope and can't be reused for a raw PDF/Excel/CSV byte stream.

import { apiClient } from './api-client';

export type ReportType =
  | 'admission_prediction' | 'financial_planning' | 'scholarship_eligibility' | 'student_progress'
  | 'college_comparison' | 'career_roadmap' | 'ai_recommendation' | 'saved_colleges';
export type ReportFormat = 'pdf' | 'xlsx' | 'csv' | 'html';

export interface ReportMetadata {
  id: string;
  reportType: ReportType;
  format: ReportFormat;
  sizeBytes: number;
  downloadCount: number;
  generatedAt: string;
  shareEnabled: boolean;
  shareToken: string | null;
  shareExpiresAt: string | null;
}

export interface ReportListResult {
  items: ReportMetadata[];
  page: number;
  limit: number;
  total: number;
}

export interface ShareResult {
  token: string;
  expiresAt: string;
  qrCodeDataUrl: string;
}

export interface SharedReportSummary {
  reportType: ReportType;
  format: ReportFormat;
  generatedAt: string;
  sizeBytes: number;
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  admission_prediction: 'Admission Prediction Report',
  financial_planning: 'Financial Planning Report',
  scholarship_eligibility: 'Scholarship Eligibility Report',
  student_progress: 'Student Progress Report',
  college_comparison: 'College Comparison Report',
  career_roadmap: 'Career Roadmap Report',
  ai_recommendation: 'AI Recommendation Report',
  saved_colleges: 'Saved Colleges Report',
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fetches an authenticated binary response and triggers a browser download, mirroring csv-export.ts's Blob-download pattern. */
export async function downloadAuthenticated(path: string, token: string, filename: string): Promise<void> {
  const res = await fetch(`/api/v1${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Download failed with status ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** The /preview route returns raw text/html, not the {success,data} JSON envelope — needs its own fetch, not apiClient. */
export async function fetchPreviewHtml(token: string, id: string): Promise<string> {
  const res = await fetch(`/api/v1/student-reports/${id}/preview`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message || `Preview failed with status ${res.status}`);
  }
  return res.text();
}

export const reportsApi = {
  generate: (token: string, reportType: ReportType, format: ReportFormat, params?: Record<string, unknown>) =>
    apiClient.post<ReportMetadata>('/student-reports/generate', { reportType, format, params }, token),
  list: (token: string, page = 1, limit = 20) =>
    apiClient.get<ReportListResult>(`/student-reports?page=${page}&limit=${limit}`, token),
  getOne: (token: string, id: string) => apiClient.get<ReportMetadata>(`/student-reports/${id}`, token),
  downloadUrl: (id: string) => `/student-reports/${id}/download`,
  regenerate: (token: string, id: string) => apiClient.post<ReportMetadata>(`/student-reports/${id}/regenerate`, undefined, token),
  remove: (token: string, id: string) => apiClient.del<{ deleted: boolean }>(`/student-reports/${id}`, token),
  createShare: (token: string, id: string) => apiClient.post<ShareResult>(`/student-reports/${id}/share`, undefined, token),
  disableShare: (token: string, id: string) => apiClient.del<{ shareEnabled: boolean }>(`/student-reports/${id}/share`, token),
  email: (token: string, id: string, to?: string) => apiClient.post<{ sent: boolean }>(`/student-reports/${id}/email`, { to }, token),
  getShared: (shareToken: string) => apiClient.get<SharedReportSummary>(`/student-reports/shared/${shareToken}`),
  sharedDownloadUrl: (shareToken: string) => `/api/v1/student-reports/shared/${shareToken}/download`,
};
