import { FinancialComparisonRow } from '../../../financial-planning/services/financial-dashboard.service';
import { ReportSection } from '../report-data.types';

export function buildFinancialPlanningSections(rows: FinancialComparisonRow[]): { sections: ReportSection[]; aiSummary: string } {
  const sections: ReportSection[] = [
    {
      key: 'cost-comparison', title: 'Fee & Cost Comparison', kind: 'table',
      data: {
        columns: ['College', 'Course', 'Total Fees (₹)', 'Hostel Cost (₹)', 'Living Cost (₹)', 'Total Cost (₹)', 'Scholarship Savings (₹)', 'Loan Needed (₹)'],
        rows: rows.map(r => [r.collegeName, r.courseName, r.totalFees, r.hostelCost, r.livingCost, r.totalCost, r.scholarshipSavings, r.loanAmountNeeded]),
      },
    },
    {
      key: 'roi-placement', title: 'Return on Investment & Placement', kind: 'table',
      data: {
        columns: ['College', 'Placement %', 'Avg Package (₹/yr)', 'Highest Package (₹/yr)', 'ROI %', 'Payback (Years)'],
        rows: rows.map(r => [r.collegeName, r.placementPercentage ?? 'N/A', r.avgPackage, r.highestPackage, r.roiPercent, r.paybackYears]),
      },
    },
    {
      key: 'total-cost-chart', title: 'Total Program Cost by College', kind: 'chart',
      data: { chartType: 'bar', data: rows.map(r => ({ label: r.collegeName, value: r.totalCost })) },
    },
  ];

  let aiSummary = 'Shortlist at least two colleges to generate a financial comparison.';
  if (rows.length > 0) {
    const cheapest = [...rows].sort((a, b) => (a.totalCost - a.scholarshipSavings) - (b.totalCost - b.scholarshipSavings))[0];
    const bestRoi = [...rows].sort((a, b) => b.roiPercent - a.roiPercent)[0];
    const loans = rows.map(r => r.loanAmountNeeded);
    aiSummary = `Across your ${rows.length} shortlisted college${rows.length === 1 ? '' : 's'}, ${cheapest.collegeName} has the lowest net cost after scholarships (₹${Math.round(cheapest.totalCost - cheapest.scholarshipSavings).toLocaleString('en-IN')}), `
      + `while ${bestRoi.collegeName} offers the strongest ROI at ${bestRoi.roiPercent}%. `
      + `Estimated loan requirement across your shortlist ranges from ₹${Math.min(...loans).toLocaleString('en-IN')} to ₹${Math.max(...loans).toLocaleString('en-IN')}.`;
  }

  return { sections, aiSummary };
}
