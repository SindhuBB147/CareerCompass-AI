import { Injectable } from '@nestjs/common';
import { ReportData, ReportSection } from '../templates/report-data.types';

/**
 * Server-side CSV builder — deliberately not shared with apps/web's
 * lib/csv-export.ts (no shared package between apps/api and apps/web
 * exists in this repo), but implements the same escaping contract:
 * double-quote any cell containing a comma, quote, or newline, and double
 * up embedded quotes.
 */
@Injectable()
export class CsvRendererService {
  renderToCsv(data: ReportData): Buffer {
    const lines: string[] = [];
    lines.push(row(['Report', data.reportTitle]));
    lines.push(row(['Student', data.student.fullName]));
    lines.push(row(['Generated', data.generatedAt.toISOString()]));
    lines.push('');

    for (const section of data.sections) {
      lines.push(row([section.title]));
      lines.push(...this.sectionRows(section));
      lines.push('');
    }

    return Buffer.from(lines.join('\n'), 'utf-8');
  }

  private sectionRows(section: ReportSection): string[] {
    switch (section.kind) {
      case 'table':
        return [row(section.data.columns), ...section.data.rows.map(r => row(r.map(String)))];
      case 'keyValue':
        return [row(['Field', 'Value']), ...section.data.map(i => row([i.label, i.value]))];
      case 'chart':
        return [row(['Label', 'Value']), ...section.data.data.map(d => row([d.label, String(d.value)]))];
      case 'text':
        return [row([section.data])];
    }
  }
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function row(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(',');
}
