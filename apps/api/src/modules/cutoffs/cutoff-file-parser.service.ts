import { Injectable, HttpStatus } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { DomainException } from '../../common/filters/domain.exception';

export interface ParsedFile {
  headers: string[];
  rows: Record<string, string>[];
}

@Injectable()
export class CutoffFileParserService {
  async parse(buffer: Buffer, filename: string): Promise<ParsedFile> {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'xlsx' || ext === 'xls') return this.parseExcel(buffer);
    if (ext === 'csv') return this.parseCsv(buffer);
    throw new DomainException('VALIDATION_ERROR', `Unsupported file type ".${ext}" — upload a .csv or .xlsx file.`, HttpStatus.BAD_REQUEST);
  }

  private async parseExcel(buffer: Buffer): Promise<ParsedFile> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      throw new DomainException('VALIDATION_ERROR', 'The spreadsheet has no data rows below the header.', HttpStatus.BAD_REQUEST);
    }

    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });

    const rows: Record<string, string>[] = [];
    for (let r = 2; r <= sheet.rowCount; r++) {
      const row = sheet.getRow(r);
      if (row.cellCount === 0) continue;
      const record: Record<string, string> = {};
      let hasValue = false;
      headers.forEach((header, idx) => {
        if (!header) return;
        const cell = row.getCell(idx + 1);
        let value = cell.value;
        if (value && typeof value === 'object' && 'result' in (value as any)) value = (value as any).result;
        if (value && typeof value === 'object' && 'text' in (value as any)) value = (value as any).text;
        const str = value === null || value === undefined ? '' : String(value).trim();
        if (str) hasValue = true;
        record[header] = str;
      });
      if (hasValue) rows.push(record);
    }

    return { headers, rows };
  }

  private parseCsv(buffer: Buffer): ParsedFile {
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const records = parseCsvText(text);
    if (records.length < 2) return { headers: [], rows: [] };

    const headers = records[0].map((h) => h.trim());
    const rows = records.slice(1)
      .filter((cells) => cells.some((c) => c.trim() !== ''))
      .map((cells) => {
        const record: Record<string, string> = {};
        headers.forEach((h, idx) => { record[h] = (cells[idx] ?? '').trim(); });
        return record;
      });

    return { headers, rows };
  }
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas/newlines,
// and "" escaped quotes — good enough for real-world Excel-exported CSVs.
function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}
