import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { CutoffService } from './cutoff.service';
import { CollegeRepository } from '../colleges/repositories/college.repository';
import { PdfRendererService } from '../student-reports/services/pdf-renderer.service';
import { Cutoff } from './models/cutoff.model';

export interface CutoffPdfOptions {
  collegeId: string;
  examCode?: string;
  year?: number;
  round?: number;
  courseId?: string;
  category?: string;
  branch?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CutoffPdfGeneratorService {
  private readonly logger = new Logger('CutoffPdfGeneratorService');

  constructor(
    private readonly cutoffService: CutoffService,
    private readonly collegeRepo: CollegeRepository,
    @Inject(forwardRef(() => PdfRendererService)) private readonly pdfRenderer: PdfRendererService,
  ) {}

  async generatePdf(options: CutoffPdfOptions): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const { collegeId, examCode = 'KCET', year, round, courseId, category = 'GM', branch, search, sortBy = 'year', sortOrder = 'desc' } = options;

    // 1. Fetch College Details
    let collegeName = 'College';
    let collegeCode = collegeId;
    try {
      const college = await this.collegeRepo.findById(collegeId);
      if (college) {
        collegeName = college.name;
        collegeCode = college.collegeId || college.id || collegeId;
      }
    } catch {
      // Fallback if college lookup fails
    }

    // 2. Fetch Cutoff Rows (Limit 500 for PDF report)
    const result = await this.cutoffService.getFilteredCutoffs(collegeId, {
      examCode,
      year,
      round,
      courseId,
      category,
      branch,
      search,
      page: 1,
      limit: 500,
      sortBy,
      sortOrder,
    });

    const rows: Cutoff[] = (result.results || []) as any[];
    const totalRows = result.total || rows.length;

    // 3. Fetch Summary & AI Insights & Trends
    const summary = await this.cutoffService.getSummary(collegeId, examCode, courseId, category).catch(() => null);
    const aiInsights = await this.cutoffService.getAIInsights(collegeId, courseId, examCode, category).catch(() => null);
    const trends = courseId ? await this.cutoffService.getTrends(collegeId, courseId, examCode, category).catch(() => null) : null;

    // 4. Generate HTML Report Document
    const html = this.buildReportHtml({
      collegeName,
      collegeCode,
      examCode,
      year,
      round,
      courseId,
      category,
      branch,
      search,
      rows,
      totalRows,
      summary,
      aiInsights,
      trends,
      generatedAt: new Date(),
    });

    // 5. Render to PDF
    let buffer: Buffer;
    try {
      buffer = await this.pdfRenderer.renderToPdf(html);
    } catch (err: any) {
      this.logger.warn(`Puppeteer PDF render failed: ${err.message} — generating fallback HTML/PDF printable document`);
      buffer = Buffer.from(html, 'utf-8');
    }

    // 6. Generate Filename: CollegeName_Exam_Cutoff_Year.pdf
    const sanitizedCollege = collegeCode.replace(/[^a-zA-Z0-9]/g, '_') || 'College';
    const sanitizedExam = examCode.replace(/[^a-zA-Z0-9]/g, '_');
    const yearStr = year ? `${year}` : summary?.latestAcademicYear ? `${summary.latestAcademicYear}` : 'AllYears';
    const filename = `${sanitizedCollege}_${sanitizedExam}_Cutoff_${yearStr}.pdf`;

    return {
      buffer,
      filename,
      contentType: 'application/pdf',
    };
  }

  private buildReportHtml(data: {
    collegeName: string;
    collegeCode: string;
    examCode: string;
    year?: number;
    round?: number;
    courseId?: string;
    category?: string;
    branch?: string;
    search?: string;
    rows: any[];
    totalRows: number;
    summary: any;
    aiInsights: any;
    trends: any;
    generatedAt: Date;
  }): string {
    const formattedDate = data.generatedAt.toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    // Generate Dynamic Extra Columns
    // openingRank/seatsAvailable/remarks/admissionCode are retired fields — kept here (rather
    // than dropped) so any legacy record that still has them stored doesn't resurface them as
    // an auto-detected "extra" PDF column.
    const knownKeys = new Set(['_id', 'id', 'collegeId', 'courseId', 'courseName', 'examCode', 'year', 'round', 'category', 'quota', 'branch', 'closingRank', 'source', 'lastUpdated', 'createdAt', 'updatedAt', 'openingRank', 'seatsAvailable', 'remarks', 'admissionCode', 'status', 'verifiedBy', 'metadata', '__v']);
    const extraKeys = new Set<string>();
    for (const r of data.rows) {
      for (const k of Object.keys(r)) {
        if (!knownKeys.has(k) && r[k] !== undefined && r[k] !== null) {
          extraKeys.add(k);
        }
      }
    }
    const extraCols = Array.from(extraKeys);

    // Build SVG Trend Chart HTML if data points exist
    let chartHtml = '';
    if (data.rows.length > 0) {
      const yearMap = new Map<number, any>();
      for (const r of data.rows) {
        const existing = yearMap.get(r.year);
        if (!existing || r.round >= existing.round) {
          yearMap.set(r.year, r);
        }
      }
      const points = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
      if (points.length > 0) {
        const maxRank = Math.max(...points.map((p) => p.closingRank), 1);
        const width = 640;
        const height = 180;
        const pad = { top: 25, right: 30, bottom: 35, left: 55 };
        const chartW = width - pad.left - pad.right;
        const chartH = height - pad.top - pad.bottom;
        const barGap = 28;
        const barW = Math.min(56, (chartW - barGap * (points.length - 1)) / points.length);

        const barsSvg = points
          .map((p, idx) => {
            const barH = (p.closingRank / maxRank) * chartH;
            const x = pad.left + idx * (barW + barGap) + barGap / 2;
            const y = height - pad.bottom - barH;
            return `
              <rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="#2563EB" opacity="0.85" />
              <text x="${x + barW / 2}" y="${y - 6}" text-anchor="middle" font-size="10" font-weight="700" fill="#0F172A">#${p.closingRank.toLocaleString()}</text>
              <text x="${x + barW / 2}" y="${height - pad.bottom + 16}" text-anchor="middle" font-size="11" fill="#475569">${p.year} (R${p.round})</text>
            `;
          })
          .join('');

        chartHtml = `
          <div class="section-block">
            <h3 class="section-title">📊 Multi-Year Closing Rank Trend</h3>
            <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 12px; text-align: center;">
              <svg viewBox="0 0 ${width} ${height}" style="max-width: 100%; height: auto;" xmlns="http://www.w3.org/2000/svg">
                <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#CBD5E1" />
                <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" stroke="#CBD5E1" />
                ${barsSvg}
              </svg>
            </div>
          </div>
        `;
      }
    }

    // Build Table Rows HTML
    const tableRowsHtml = data.rows.length === 0
      ? `<tr><td colspan="${6 + extraCols.length}" style="text-align: center; padding: 24px; color: #64748B;">No cutoff records found for the selected filters.</td></tr>`
      : data.rows
          .map(
            (r, idx) => `
          <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
            <td><strong>${r.year}</strong></td>
            <td><span class="badge badge-blue">${r.examCode}</span></td>
            <td><strong>${r.courseName || r.courseId}</strong></td>
            <td>R${r.round}</td>
            <td><span class="badge badge-slate">${r.category}</span></td>
            <td style="color: #2563EB; font-weight: 700;">#${r.closingRank.toLocaleString()}</td>
            ${extraCols.map((c) => `<td>${r[c] !== undefined ? String(r[c]) : '—'}</td>`).join('')}
          </tr>
        `,
          )
          .join('');

    // AI Insights HTML Section
    const aiSectionHtml = data.aiInsights
      ? `
        <div class="section-block ai-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 class="section-title" style="margin: 0; color: #1E40AF;">🤖 AI Analysis</h3>
            <span class="badge badge-blue">AI-Generated Insights</span>
          </div>
          <p style="font-weight: 600; font-size: 14px; color: #0F172A; margin: 0 0 10px;">${data.aiInsights.summaryText || 'Dynamic cutoff shift analysis based on historical trends.'}</p>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10px;">
            <div class="stat-card">
              <span class="stat-label">Trend Direction</span>
              <div class="stat-value" style="color: ${data.aiInsights.trendDirection === 'tightened' ? '#DC2626' : '#16A34A'}; text-transform: capitalize;">
                ${data.aiInsights.trendDirection || 'Stable'} (${data.aiInsights.percentageChange > 0 ? `+${data.aiInsights.percentageChange}%` : `${data.aiInsights.percentageChange || 0}%`})
              </div>
            </div>
            ${
              data.aiInsights.predictedRankRange
                ? `
            <div class="stat-card">
              <span class="stat-label">Expected Next Year Cutoff</span>
              <div class="stat-value" style="color: #2563EB;">#${data.aiInsights.predictedRankRange.min} – #${data.aiInsights.predictedRankRange.max}</div>
            </div>
            `
                : ''
            }
          </div>

          ${
            data.aiInsights.keyInsights?.length
              ? `
            <div style="margin-top: 10px;">
              <strong style="font-size: 12px; color: #334155;">Key Observations & Guidance:</strong>
              <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 12px; color: #475569;">
                ${data.aiInsights.keyInsights.map((k: string) => `<li>${k}</li>`).join('')}
              </ul>
            </div>
          `
              : ''
          }
        </div>
      `
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${data.collegeName} - Cutoff Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 12mm 12mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .header-table {
      width: 100%;
      border-collapse: collapse;
      border-bottom: 2px solid #0F172A;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand-logo {
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.5px;
    }
    .brand-logo span {
      color: #2563EB;
    }
    .report-title {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
      margin: 2px 0 0 0;
    }
    .meta-text {
      font-size: 11px;
      color: #64748B;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-blue {
      background: #EFF6FF;
      color: #2563EB;
      border: 1px solid #BFDBFE;
    }
    .badge-slate {
      background: #F1F5F9;
      color: #334155;
      border: 1px solid #CBD5E1;
    }
    .summary-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
      margin-bottom: 16px;
    }
    .summary-cell {
      display: table-cell;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px 10px;
      vertical-align: top;
    }
    .stat-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      display: block;
    }
    .stat-value {
      font-size: 15px;
      font-weight: 700;
      color: #0F172A;
      margin-top: 2px;
    }
    .filter-box {
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 10px 12px;
      margin-bottom: 16px;
      font-size: 11px;
    }
    .filter-title {
      font-weight: 700;
      color: #1E293B;
      margin-bottom: 4px;
    }
    .filter-item {
      display: inline-block;
      margin-right: 14px;
      color: #475569;
    }
    .filter-item strong {
      color: #0F172A;
    }
    .section-block {
      margin-bottom: 18px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 14px;
      font-weight: 700;
      color: #0F172A;
      margin: 0 0 8px 0;
      border-bottom: 1px solid #E2E8F0;
      padding-bottom: 4px;
    }
    .main-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-bottom: 16px;
    }
    .main-table th {
      background-color: #1E293B;
      color: #FFFFFF;
      text-align: left;
      padding: 7px 9px;
      font-weight: 600;
    }
    .main-table td {
      padding: 7px 9px;
      border-bottom: 1px solid #E2E8F0;
    }
    .main-table thead {
      display: table-header-group;
    }
    .main-table tr {
      page-break-inside: avoid;
    }
    .ai-card {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .footer-bar {
      margin-top: 24px;
      border-top: 1px solid #E2E8F0;
      padding-top: 8px;
      font-size: 10px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <!-- HEADER -->
  <table class="header-table">
    <tr>
      <td>
        <div class="brand-logo">🧭 CareerCompass <span>AI</span></div>
        <div class="report-title">${data.collegeName}</div>
        <div class="meta-text">Official College Cutoff Analytics Report • Admission Code: ${data.collegeCode}</div>
      </td>
      <td style="text-align: right; vertical-align: top;">
        <span class="badge badge-blue" style="font-size: 13px; padding: 4px 10px;">${data.examCode}</span>
        <div class="meta-text" style="margin-top: 6px;">Generated: ${formattedDate}</div>
      </td>
    </tr>
  </table>

  <!-- REPORT SUMMARY CARDS -->
  <div class="summary-grid">
    <div class="summary-cell" style="margin-right: 6px;">
      <span class="stat-label">Academic Year</span>
      <div class="stat-value">${data.year ? `${data.year}` : data.summary?.latestAcademicYear ? `${data.summary.latestAcademicYear}` : 'All Years'}</div>
    </div>
    <div class="summary-cell" style="margin-right: 6px;">
      <span class="stat-label">Latest Round</span>
      <div class="stat-value">${data.round ? `Round ${data.round}` : data.summary?.latestRound ? `Round ${data.summary.latestRound}` : 'All Rounds'}</div>
    </div>
    <div class="summary-cell" style="margin-right: 6px;">
      <span class="stat-label">Lowest Closing Rank</span>
      <div class="stat-value" style="color: #2563EB;">${data.summary?.lowestClosingRank ? `#${data.summary.lowestClosingRank.toLocaleString()}` : '—'}</div>
    </div>
    <div class="summary-cell" style="margin-right: 6px;">
      <span class="stat-label">Highest Closing Rank</span>
      <div class="stat-value">${data.summary?.highestClosingRank ? `#${data.summary.highestClosingRank.toLocaleString()}` : '—'}</div>
    </div>
    <div class="summary-cell">
      <span class="stat-label">Records Filtered</span>
      <div class="stat-value">${data.totalRows} Records</div>
    </div>
  </div>

  <!-- FILTER SUMMARY BOX -->
  <div class="filter-box">
    <div class="filter-title">🔍 Applied Report Filters:</div>
    <span class="filter-item">College: <strong>${data.collegeName} (${data.collegeCode})</strong></span>
    <span class="filter-item">Exam: <strong>${data.examCode}</strong></span>
    <span class="filter-item">Year: <strong>${data.year || 'All Years'}</strong></span>
    <span class="filter-item">Round: <strong>${data.round ? `Round ${data.round}` : 'All Rounds'}</strong></span>
    <span class="filter-item">Course: <strong>${data.courseId || 'All Courses'}</strong></span>
    <span class="filter-item">Category: <strong>${data.category || 'GM'}</strong></span>
    ${data.branch ? `<span class="filter-item">Branch: <strong>${data.branch}</strong></span>` : ''}
    ${data.search ? `<span class="filter-item">Search Query: <strong>"${data.search}"</strong></span>` : ''}
  </div>

  <!-- MAIN DATA TABLE -->
  <div class="section-block">
    <h3 class="section-title">📋 Cutoff Records</h3>
    <table class="main-table">
      <thead>
        <tr>
          <th>Year</th>
          <th>Exam</th>
          <th>Course / Branch</th>
          <th>Round</th>
          <th>Category</th>
          <th>Closing Rank</th>
          ${extraCols.map((c) => `<th style="text-transform: capitalize;">${c}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>
  </div>

  <!-- TREND CHART SECTION -->
  ${chartHtml}

  <!-- AI INSIGHTS SECTION -->
  ${aiSectionHtml}

  <!-- FOOTER -->
  <div class="footer-bar">
    <div>CareerCompass AI Platform • Confidential & Proprietary Report</div>
    <div>Document Reference: ${data.collegeCode}-${data.examCode}-${data.generatedAt.getTime()}</div>
  </div>
</body>
</html>`;
  }
}
