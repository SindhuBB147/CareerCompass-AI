import * as ExcelJS from 'exceljs';
import { ExcelRendererService } from '../../src/modules/student-reports/services/excel-renderer.service';
import { ReportData } from '../../src/modules/student-reports/templates/report-data.types';

describe('ExcelRendererService', () => {
  const service = new ExcelRendererService();

  const data: ReportData = {
    reportType: 'financial_planning',
    reportTitle: 'Financial Planning Report',
    generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    student: { fullName: 'Asha Rao', examProfiles: [] },
    sections: [
      { key: 'table', title: 'Cost Comparison', kind: 'table', data: { columns: ['College', 'Total Cost'], rows: [['RVCE', 500000]] } },
      { key: 'kv', title: 'Overview', kind: 'keyValue', data: [{ label: 'Loan Needed', value: '₹200,000' }] },
    ],
    aiSummary: 'Summary text.',
  };

  it('produces a non-empty, valid xlsx buffer with a summary sheet and one sheet per section', async () => {
    const buffer = await service.renderToExcel(data);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

    const sheetNames = workbook.worksheets.map(ws => ws.name);
    expect(sheetNames).toContain('Summary');
    expect(sheetNames).toContain('Cost Comparison');
    expect(sheetNames).toContain('Overview');

    const costSheet = workbook.getWorksheet('Cost Comparison')!;
    expect(costSheet.getRow(1).getCell(1).value).toBe('College');
    expect(costSheet.getRow(2).getCell(2).value).toBe(500000);
  });
});
