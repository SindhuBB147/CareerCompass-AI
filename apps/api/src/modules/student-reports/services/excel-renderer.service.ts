import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ReportData, ReportSection } from '../templates/report-data.types';

@Injectable()
export class ExcelRendererService {
  async renderToExcel(data: ReportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CareerCompass AI';
    workbook.created = data.generatedAt;

    const summary = workbook.addWorksheet('Summary');
    summary.columns = [{ width: 28 }, { width: 60 }];
    summary.addRow(['Report', data.reportTitle]);
    summary.addRow(['Student', data.student.fullName]);
    summary.addRow(['Generated', data.generatedAt.toLocaleDateString('en-IN')]);
    summary.addRow([]);
    summary.addRow(['Executive Summary']).font = { bold: true };
    summary.addRow([data.aiSummary]);
    summary.getRow(1).font = { bold: true };

    for (const section of data.sections) {
      const sheet = workbook.addWorksheet(sheetName(section));
      this.writeSection(sheet, section);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private writeSection(sheet: ExcelJS.Worksheet, section: ReportSection): void {
    switch (section.kind) {
      case 'table': {
        sheet.addRow(section.data.columns).font = { bold: true };
        for (const row of section.data.rows) sheet.addRow(row);
        sheet.columns.forEach(col => { col.width = 20; });
        break;
      }
      case 'keyValue': {
        sheet.addRow(['Field', 'Value']).font = { bold: true };
        for (const item of section.data) sheet.addRow([item.label, item.value]);
        sheet.columns.forEach(col => { col.width = 30; });
        break;
      }
      case 'chart': {
        sheet.addRow(['Label', 'Value']).font = { bold: true };
        for (const d of section.data.data) sheet.addRow([d.label, d.value]);
        sheet.columns.forEach(col => { col.width = 24; });
        break;
      }
      case 'text': {
        sheet.getColumn(1).width = 100;
        sheet.addRow([section.data]);
        break;
      }
    }
  }
}

function sheetName(section: ReportSection): string {
  // Excel sheet names: max 31 chars, no []:*?/\\
  return section.title.replace(/[[\]:*?/\\]/g, '').slice(0, 31) || section.key.slice(0, 31);
}
