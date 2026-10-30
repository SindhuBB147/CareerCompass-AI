import { ReportSection } from '../report-data.types';

export interface AdmissionPredictionDetailRow {
  collegeId: string;
  courseId: string;
  collegeName: string;
  courseName: string;
  band: string;
  probabilityPercent: number;
  trendingClosingRank: number;
  studentRank: number;
  confidenceLevel: string;
  roi: { netCost: number; projectedPackageAnnual: number; roiPercent: number; paybackYears: number } | null;
  placement: { placementPercentRange: [number, number] } | null;
  nirfRank: number | null;
}

export interface AdmissionPredictionChoiceRow {
  priority: number;
  collegeName: string;
  courseName: string;
  band: string;
  probabilityPercent: number;
}

/** Pure shape-builder — no DB access. Every number here traces to a real,
 * already-fetched prediction/ROI/placement/college record. */
export function buildAdmissionPredictionSections(input: {
  allBands: string[];
  detailRows: AdmissionPredictionDetailRow[];
  choiceRows: AdmissionPredictionChoiceRow[];
}): { sections: ReportSection[]; aiSummary: string } {
  const { allBands, detailRows, choiceRows } = input;

  const bandCounts: Record<string, number> = { Safe: 0, Moderate: 0, Ambitious: 0, Reach: 0 };
  for (const band of allBands) if (band in bandCounts) bandCounts[band]++;

  const sections: ReportSection[] = [
    {
      key: 'probability-distribution', title: 'Probability Distribution', kind: 'chart',
      data: { chartType: 'donut', data: Object.entries(bandCounts).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value })) },
    },
    {
      key: 'shortlist-detail', title: 'Shortlisted Colleges — Admission Probability & ROI', kind: 'table',
      data: {
        columns: ['College', 'Course', 'Band', 'Probability %', 'Trending Closing Rank', 'Your Rank', 'Confidence', 'Net Cost (₹)', 'Projected Package (₹/yr)', 'ROI %'],
        rows: detailRows.map(r => [
          r.collegeName, r.courseName, r.band, r.probabilityPercent,
          r.trendingClosingRank, r.studentRank, r.confidenceLevel,
          r.roi?.netCost ?? 'N/A', r.roi?.projectedPackageAnnual ?? 'N/A', r.roi?.roiPercent ?? 'N/A',
        ]),
      },
    },
    {
      key: 'nirf-ranking', title: 'NIRF Ranking Table', kind: 'table',
      data: {
        columns: ['College', 'NIRF Rank'],
        rows: detailRows.map(r => [r.collegeName, r.nirfRank ?? 'Not Ranked']),
      },
    },
  ];

  if (choiceRows.length > 0) {
    sections.push({
      key: 'choice-filling', title: 'Recommended Next Steps — Choice-Filling Order', kind: 'table',
      data: {
        columns: ['Priority', 'College', 'Course', 'Band', 'Probability %'],
        rows: choiceRows.map(r => [r.priority, r.collegeName, r.courseName, r.band, r.probabilityPercent]),
      },
    });
  }

  const safest = [...detailRows].sort((a, b) => b.probabilityPercent - a.probabilityPercent)[0];
  const topChoice = choiceRows[0];
  const aiSummary = safest
    ? `Across your ${detailRows.length} shortlisted college${detailRows.length === 1 ? '' : 's'}, you have ${bandCounts.Safe} Safe, ${bandCounts.Moderate} Moderate, ${bandCounts.Ambitious} Ambitious, and ${bandCounts.Reach} Reach option${bandCounts.Reach === 1 ? '' : 's'}. `
      + `Your strongest chance is ${safest.collegeName} (${safest.courseName}) at ${safest.probabilityPercent}% probability. `
      + (topChoice ? `Based on your choice-filling optimizer, ${topChoice.collegeName} is your recommended first preference.` : '')
    : 'Add colleges to your shortlist and run predictions to generate this section.';

  return { sections, aiSummary };
}
