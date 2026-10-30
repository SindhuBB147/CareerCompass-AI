import { CollegeDocument } from '../../../colleges/models/college.model';
import { CollegeEnrichment } from '../../../wishlist/services/wishlist-enrichment.service';
import { ReportSection } from '../report-data.types';

export interface CollegeComparisonEntry {
  college: CollegeDocument;
  enrichment: CollegeEnrichment;
}

export function buildCollegeComparisonSections(entries: CollegeComparisonEntry[]): { sections: ReportSection[]; aiSummary: string } {
  const sections: ReportSection[] = [
    {
      key: 'comparison-overview', title: 'College Comparison', kind: 'table',
      data: {
        columns: ['College', 'NIRF Rank', 'Type', 'City', 'Annual Fees (₹)', 'Hostel'],
        rows: entries.map(({ college }) => [
          college.name,
          college.accreditation?.nirfRank ?? 'Unranked',
          college.collegeType,
          college.city,
          college.feeBreakdown?.totalAnnualFee ?? 0,
          college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel ? 'Available' : 'Not Available',
        ]),
      },
    },
    {
      key: 'outcomes', title: 'Admission Chances & Outcomes', kind: 'table',
      data: {
        columns: ['College', 'Admission Probability', 'ROI %', 'Placement %', 'AI Match Score'],
        rows: entries.map(({ college, enrichment }) => [
          college.name,
          enrichment.admissionProbability != null ? `${enrichment.admissionProbability}% (${enrichment.admissionProbabilityBand ?? 'N/A'})` : 'Not predicted',
          enrichment.roiPercent ?? 'N/A',
          enrichment.placementPercentage ?? 'N/A',
          enrichment.aiRecommendationScore,
        ]),
      },
    },
    {
      key: 'fees-chart', title: 'Annual Fees by College', kind: 'chart',
      data: { chartType: 'bar', data: entries.map(({ college }) => ({ label: college.name, value: college.feeBreakdown?.totalAnnualFee ?? 0 })) },
    },
  ];

  let aiSummary = 'Save at least two colleges to your wishlist to generate a comparison.';
  if (entries.length > 0) {
    const cheapest = [...entries].sort((a, b) => (a.college.feeBreakdown?.totalAnnualFee ?? 0) - (b.college.feeBreakdown?.totalAnnualFee ?? 0))[0];
    const bestOdds = [...entries].filter(e => e.enrichment.admissionProbability != null).sort((a, b) => (b.enrichment.admissionProbability ?? 0) - (a.enrichment.admissionProbability ?? 0))[0];
    const bestRanked = [...entries].filter(e => e.college.accreditation?.nirfRank != null).sort((a, b) => (a.college.accreditation!.nirfRank! - b.college.accreditation!.nirfRank!))[0];
    aiSummary = `Comparing ${entries.length} colleges: ${cheapest.college.name} has the lowest annual fees (₹${(cheapest.college.feeBreakdown?.totalAnnualFee ?? 0).toLocaleString('en-IN')}). `
      + (bestOdds ? `${bestOdds.college.name} gives you the strongest admission odds at ${bestOdds.enrichment.admissionProbability}%. ` : '')
      + (bestRanked ? `${bestRanked.college.name} holds the best NIRF rank (#${bestRanked.college.accreditation!.nirfRank}).` : '');
  }

  return { sections, aiSummary };
}
