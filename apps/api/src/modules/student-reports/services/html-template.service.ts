import { Injectable } from '@nestjs/common';
import { ReportChart, ReportData, ReportSection } from '../templates/report-data.types';

const ACCENT_BLUE = '#2D6EA3';
const TEXT_PRIMARY = '#111111';
const TEXT_MUTED = '#777777';
const BORDER_COLOR = '#ECECEC';
const BG_MAIN = '#F8F8F6';
const PALETTE = [ACCENT_BLUE, TEXT_PRIMARY, '#7A9CB5', '#B5C9D6', '#3D5A73', '#9AAEB8', '#5E7A8C'];

/**
 * Builds the single branded HTML document every report type renders to —
 * consumed by PdfRendererService (Puppeteer -> PDF) and the "Printable
 * HTML" preview/download route directly. Puppeteer can't import the
 * apps/web React chart components, so the small inline-SVG chart builders
 * below are a deliberate, simple re-implementation matching the same visual
 * language (see BarChart.tsx / DonutChart.tsx) rather than a shared package.
 */
@Injectable()
export class HtmlTemplateService {
  render(data: ReportData): string {
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.reportTitle)}</title>
<style>${this.styles()}</style>
</head>
<body>
  <div class="report-doc">
    ${this.header(data)}
    ${this.aiSummaryBlock(data)}
    ${this.indexBlock(data)}
    ${data.sections.map(s => this.section(s)).join('\n')}
    ${this.footer()}
  </div>
</body>
</html>`;
  }

  private header(data: ReportData): string {
    const generated = data.generatedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    return `
    <header class="report-header">
      <div class="report-brand">CareerCompass<sup>AI</sup></div>
      <h1>${escapeHtml(data.reportTitle)}</h1>
      <div class="report-meta">
        <span><strong>Student:</strong> ${escapeHtml(data.student.fullName)}</span>
        <span><strong>Generated:</strong> ${generated}</span>
        <span><strong>Report Version:</strong> 1.0</span>
      </div>
    </header>`;
  }

  private aiSummaryBlock(data: ReportData): string {
    if (!data.aiSummary) return '';
    return `
    <section class="report-summary-box">
      <div class="report-summary-label">Executive Summary</div>
      <p>${escapeHtml(data.aiSummary)}</p>
    </section>`;
  }

  private indexBlock(data: ReportData): string {
    return `
    <nav class="report-index">
      <div class="report-summary-label">In This Report</div>
      <ol>${data.sections.map(s => `<li>${escapeHtml(s.title)}</li>`).join('')}</ol>
    </nav>`;
  }

  private section(section: ReportSection): string {
    const body = section.kind === 'table' ? this.table(section.data)
      : section.kind === 'keyValue' ? this.keyValue(section.data)
      : section.kind === 'chart' ? this.chart(section.data)
      : `<p>${escapeHtml(section.data)}</p>`;
    return `
    <section class="report-section">
      <h2>${escapeHtml(section.title)}</h2>
      ${body}
    </section>`;
  }

  private table(t: { columns: string[]; rows: (string | number)[][] }): string {
    return `<table class="report-table">
      <thead><tr>${t.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>${t.rows.map(r => `<tr>${r.map(cell => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  }

  private keyValue(items: Array<{ label: string; value: string }>): string {
    return `<div class="report-kv-grid">${items.map(i => `
      <div class="report-kv-item">
        <div class="report-kv-label">${escapeHtml(i.label)}</div>
        <div class="report-kv-value">${escapeHtml(i.value)}</div>
      </div>`).join('')}</div>`;
  }

  private chart(chart: ReportChart): string {
    return chart.chartType === 'donut' ? this.donutSvg(chart.data) : this.barSvg(chart.data);
  }

  private barSvg(data: ReportChart['data']): string {
    if (data.length === 0) return '<p class="report-empty">No data available.</p>';
    const width = 640;
    const height = 220;
    const max = Math.max(...data.map(d => d.value), 1);
    const barWidth = width / data.length;
    const bars = data.map((d, i) => {
      const barHeight = (d.value / max) * (height - 40);
      const x = i * barWidth + barWidth * 0.15;
      const w = barWidth * 0.7;
      const y = height - 30 - barHeight;
      return `<rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="2" fill="${ACCENT_BLUE}" />
        <text x="${x + w / 2}" y="${height - 10}" text-anchor="middle" font-size="11" fill="${TEXT_MUTED}">${escapeHtml(truncate(d.label, 12))}</text>
        <text x="${x + w / 2}" y="${y - 6}" text-anchor="middle" font-size="11" fill="${TEXT_PRIMARY}">${d.value}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${bars}</svg>`;
  }

  private donutSvg(data: ReportChart['data']): string {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (total <= 0) return '<p class="report-empty">No data available.</p>';
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    let offsetAccum = 0;
    const arcs = data.map((d, i) => {
      const fraction = d.value / total;
      const dash = fraction * circumference;
      const gap = circumference - dash;
      const circle = `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="14" stroke-dasharray="${dash} ${gap}" stroke-dashoffset="${-offsetAccum}" />`;
      offsetAccum += dash;
      return circle;
    }).join('');
    const legend = data.map((d, i) => `
      <div class="report-legend-row">
        <span class="report-legend-swatch" style="background:${PALETTE[i % PALETTE.length]}"></span>
        <span>${escapeHtml(d.label)} — ${Math.round((d.value / total) * 100)}%</span>
      </div>`).join('');
    return `<div class="report-donut-wrap">
      <svg viewBox="0 0 100 100" width="160" height="160" style="transform:rotate(-90deg)">
        <circle cx="50" cy="50" r="${radius}" fill="none" stroke="${BORDER_COLOR}" stroke-width="14" />
        ${arcs}
      </svg>
      <div class="report-legend">${legend}</div>
    </div>`;
  }

  private footer(): string {
    return `
    <footer class="report-footer">
      <p>This report was generated automatically from your CareerCompass AI profile data as of the generation date above. Figures are estimates for planning purposes and are not a guarantee of admission, cost, or outcome.</p>
      <p>CareerCompass AI — Karnataka entrance exam admissions &amp; career guidance platform</p>
    </footer>`;
  }

  private styles(): string {
    return `
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; color: ${TEXT_PRIMARY}; margin: 0; padding: 32px 40px; background: #FFFFFF; }
    h1, h2 { font-family: Georgia, 'Playfair Display', serif; font-weight: 600; margin: 0 0 8px; }
    h1 { font-size: 26px; }
    h2 { font-size: 18px; margin-top: 0; }
    .report-brand { font-family: Georgia, 'Playfair Display', serif; font-size: 15px; color: ${TEXT_PRIMARY}; margin-bottom: 12px; }
    .report-brand sup { color: ${ACCENT_BLUE}; font-size: 10px; }
    .report-header { border-bottom: 2px solid ${TEXT_PRIMARY}; padding-bottom: 16px; margin-bottom: 20px; }
    .report-meta { display: flex; gap: 24px; font-size: 12px; color: ${TEXT_MUTED}; margin-top: 8px; }
    .report-summary-box { background: ${BG_MAIN}; border: 1px solid ${BORDER_COLOR}; border-radius: 12px; padding: 16px 20px; margin-bottom: 20px; }
    .report-summary-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: ${ACCENT_BLUE}; margin-bottom: 6px; }
    .report-summary-box p { margin: 0; line-height: 1.6; font-size: 13px; }
    .report-index { margin-bottom: 24px; }
    .report-index ol { margin: 6px 0 0; padding-left: 18px; font-size: 12px; color: ${TEXT_MUTED}; }
    .report-section { margin-bottom: 24px; page-break-inside: avoid; }
    .report-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .report-table th, .report-table td { border: 1px solid ${BORDER_COLOR}; padding: 8px 10px; text-align: left; }
    .report-table th { background: ${BG_MAIN}; font-weight: 700; }
    .report-kv-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .report-kv-item { border: 1px solid ${BORDER_COLOR}; border-radius: 10px; padding: 10px 14px; }
    .report-kv-label { font-size: 11px; color: ${TEXT_MUTED}; margin-bottom: 4px; }
    .report-kv-value { font-size: 15px; font-weight: 700; }
    .report-donut-wrap { display: flex; align-items: center; gap: 20px; }
    .report-legend { display: flex; flex-direction: column; gap: 6px; font-size: 12px; }
    .report-legend-row { display: flex; align-items: center; gap: 8px; }
    .report-legend-swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
    .report-empty { color: ${TEXT_MUTED}; font-size: 13px; }
    .report-footer { border-top: 1px solid ${BORDER_COLOR}; margin-top: 32px; padding-top: 12px; font-size: 10px; color: ${TEXT_MUTED}; line-height: 1.5; }
    `;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
