import { CsvRendererService } from '../../src/modules/student-reports/services/csv-renderer.service';
import { ReportData } from '../../src/modules/student-reports/templates/report-data.types';

describe('CsvRendererService', () => {
  const service = new CsvRendererService();

  const baseData: ReportData = {
    reportType: 'student_progress',
    reportTitle: 'Student Progress Report',
    generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    student: { fullName: 'Asha Rao', examProfiles: [] },
    sections: [
      { key: 'kv', title: 'Overview', kind: 'keyValue', data: [{ label: 'Profile Completion', value: '80%' }] },
      { key: 'table', title: 'Table Section', kind: 'table', data: { columns: ['A', 'B'], rows: [[1, 2], ['x', 'y']] } },
      { key: 'chart', title: 'Chart Section', kind: 'chart', data: { chartType: 'bar', data: [{ label: 'Safe', value: 3 }] } },
      { key: 'text', title: 'Text Section', kind: 'text', data: 'A plain summary.' },
    ],
    aiSummary: 'Summary text.',
  };

  it('renders a non-empty CSV buffer containing every section title', () => {
    const buffer = service.renderToCsv(baseData);
    expect(buffer.length).toBeGreaterThan(0);
    const csv = buffer.toString('utf-8');
    expect(csv).toContain('Overview');
    expect(csv).toContain('Table Section');
    expect(csv).toContain('Chart Section');
    expect(csv).toContain('Text Section');
    expect(csv).toContain('Asha Rao');
  });

  it('escapes cells containing commas, quotes, and newlines', () => {
    const data: ReportData = {
      ...baseData,
      sections: [
        { key: 'text', title: 'Notes', kind: 'text', data: 'Contains, a comma and a "quote" and a\nnewline' },
      ],
    };
    const csv = service.renderToCsv(data).toString('utf-8');
    expect(csv).toContain('"Contains, a comma and a ""quote"" and a\nnewline"');
  });

  it('flattens table rows in column order', () => {
    const csv = service.renderToCsv(baseData).toString('utf-8');
    const lines = csv.split('\n');
    const headerIdx = lines.indexOf('A,B');
    expect(headerIdx).toBeGreaterThan(-1);
    expect(lines[headerIdx + 1]).toBe('1,2');
    expect(lines[headerIdx + 2]).toBe('x,y');
  });
});
