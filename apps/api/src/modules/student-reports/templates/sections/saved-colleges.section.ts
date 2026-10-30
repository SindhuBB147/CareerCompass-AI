import { ReportSection } from '../report-data.types';

export interface SavedCollegeRow {
  collegeName: string;
  listNames: string[];
  status: string;
  admissionProbability: number | null;
  savedAt: Date;
}

const STATUS_LABELS: Record<string, string> = {
  dream: 'Dream', target: 'Target', safe: 'Safe', backup: 'Backup',
  interested: 'Interested', applied: 'Applied', admitted: 'Admitted', rejected: 'Rejected',
};

export function buildSavedCollegesSections(rows: SavedCollegeRow[]): { sections: ReportSection[]; aiSummary: string } {
  const sections: ReportSection[] = [
    {
      key: 'saved-colleges-overview', title: 'Saved Colleges Overview', kind: 'keyValue',
      data: [{ label: 'Total Saved Colleges', value: String(rows.length) }],
    },
    {
      key: 'saved-colleges-table', title: 'Your Wishlist', kind: 'table',
      data: {
        columns: ['College', 'Lists', 'Status', 'Admission Probability', 'Saved On'],
        rows: rows.map(r => [
          r.collegeName,
          r.listNames.join(', ') || '—',
          STATUS_LABELS[r.status] ?? r.status,
          r.admissionProbability != null ? `${r.admissionProbability}%` : 'Not predicted',
          new Date(r.savedAt).toDateString(),
        ]),
      },
    },
  ];

  const statusCounts = rows.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
  const topStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0];

  const aiSummary = rows.length > 0
    ? `You have ${rows.length} saved college${rows.length === 1 ? '' : 's'}` + (topStatus ? `, most marked "${STATUS_LABELS[topStatus[0]] ?? topStatus[0]}" (${topStatus[1]}).` : '.')
    : 'Save colleges to your wishlist to build this report.';

  return { sections, aiSummary };
}
