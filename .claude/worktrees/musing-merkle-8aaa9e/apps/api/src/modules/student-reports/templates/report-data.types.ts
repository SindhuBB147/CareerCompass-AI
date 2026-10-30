import { ReportType } from '../models/report.model';

// The one shared contract every renderer (PDF/Excel/CSV/Printable-HTML)
// consumes. Section builders (templates/sections/*.section.ts) are the only
// code that reads other modules' services — renderers only ever see this
// shape, so what the PDF shows and what the Excel shows can never diverge.

export interface ReportKeyValueItem { label: string; value: string; }
export interface ReportTable { columns: string[]; rows: (string | number)[][]; }
export interface ReportChartDatum { label: string; value: number; }
export interface ReportChart { chartType: 'bar' | 'donut'; data: ReportChartDatum[]; }

export type ReportSection =
  | { key: string; title: string; kind: 'keyValue'; data: ReportKeyValueItem[] }
  | { key: string; title: string; kind: 'table'; data: ReportTable }
  | { key: string; title: string; kind: 'chart'; data: ReportChart }
  | { key: string; title: string; kind: 'text'; data: string };

export interface ReportStudentSummary {
  fullName: string;
  email?: string;
  category?: string;
  domicileState?: string;
  examProfiles: Array<{ examCode: string; rank: number; year?: number }>;
}

export interface ReportData {
  reportType: ReportType;
  reportTitle: string;
  generatedAt: Date;
  student: ReportStudentSummary;
  sections: ReportSection[];
  /** Grounded, non-fabricated executive summary built from the same data as `sections` — never invented facts. */
  aiSummary: string;
}
