import { ReportSection } from '../report-data.types';

export interface AdmissionPredictionDetailRow {
  collegeId?: string;
  courseId?: string;
  collegeName: string;
  courseName: string;
  band: string;
  probabilityPercent: number;
  trendingClosingRank: number;
  studentRank: number;
  confidenceLevel: string;
  nirfRank?: number | null;
  roi?: {
    netCost: number;
    projectedPackageAnnual: number;
    roiPercent: number;
    paybackYears?: number | null;
  } | null;
  placement?: any;
}

export interface AdmissionPredictionChoiceRow {
  priority: number;
  collegeName: string;
  courseName: string;
  band: string;
  probabilityPercent: number;
}

export interface AdmissionPredictionSectionData {
  detailRows: AdmissionPredictionDetailRow[];
  choiceRows: AdmissionPredictionChoiceRow[];
  allBands: string[];
}

export function buildAdmissionPredictionSections(data: AdmissionPredictionSectionData): { sections: ReportSection[]; aiSummary: string } {
  const { detailRows, choiceRows, allBands } = data;

  const bandCounts = {
    Safe: allBands.filter(b => b === 'Safe').length,
    Moderate: allBands.filter(b => b === 'Moderate').length,
    Ambitious: allBands.filter(b => b === 'Ambitious').length,
    Reach: allBands.filter(b => b === 'Reach').length,
  };

  const sections: ReportSection[] = [
    {
      key: 'probability-distribution', title: 'Portfolio Distribution', kind: 'chart',
      data: { chartType: 'donut', data: Object.entries(bandCounts).filter(([, v]) => v > 0).map(([label, value]) => ({ label, value })) },
    },
    {
      key: 'shortlist-detail', title: 'Shortlisted Colleges — Recommendation Fit & ROI', kind: 'table',
      data: {
        columns: ['College', 'Course', 'Portfolio Band', 'Recommendation Fit Score', 'Trending Closing Rank', 'Your Rank', 'Confidence', 'Net Cost (₹)', 'Projected Package (₹/yr)', 'ROI %'],
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
        columns: ['Priority', 'College', 'Course', 'Portfolio Band', 'Recommendation Fit Score'],
        rows: choiceRows.map(r => [r.priority, r.collegeName, r.courseName, r.band, r.probabilityPercent]),
      },
    });
  }

  const safest = [...detailRows].sort((a, b) => b.probabilityPercent - a.probabilityPercent)[0];
  const topChoice = choiceRows[0];
  const aiSummary = safest
    ? `Across your ${detailRows.length} shortlisted college${detailRows.length === 1 ? '' : 's'}, you have ${bandCounts.Safe} Safe, ${bandCounts.Moderate} Moderate, ${bandCounts.Ambitious} Ambitious, and ${bandCounts.Reach} Reach option${bandCounts.Reach === 1 ? '' : 's'}. `
      + `Your highest recommendation fit match is ${safest.collegeName} (${safest.courseName}) with a Recommendation Fit Score of ${safest.probabilityPercent}/100. `
      + (topChoice ? `Based on your choice-filling optimizer, ${topChoice.collegeName} is your recommended first preference.` : '')
    : 'Add colleges to your shortlist and run predictions to generate this section.';

  return {
    sections: sections.map(s => s.key === 'shortlist-detail' ? { ...s, aiSummary } : s),
    aiSummary
  };
}

