'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { financialApi, type FinancialDashboardResult } from '../../../lib/financial-api';
import { StatTile } from '../../../components/financial/StatTile';
import { DonutChart } from '../../../components/financial/DonutChart';
import { PrintableReport } from '../../../components/financial/PrintableReport';
import { downloadCsv } from '../../../lib/csv-export';
import type { PlannerSelection } from './PlannerForm';

function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatLakh(n: number): string {
  return `₹${(n / 100000).toFixed(2)} L`;
}

function aggregateByLabel(result: FinancialDashboardResult): { label: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const year of result.feeBreakdown.yearly) {
    for (const li of year.lineItems) {
      totals.set(li.label, (totals.get(li.label) ?? 0) + li.amount);
    }
  }
  return Array.from(totals.entries()).map(([label, amount]) => ({ label, amount }));
}

const DISTRIBUTION_GROUPS: { group: string; labels: string[] }[] = [
  { group: 'Tuition & Academic Fees', labels: ['Tuition Fee', 'Development Fee', 'Laboratory Fee', 'Library Fee', 'Examination Fee', 'University / Other Charges'] },
  { group: 'Hostel & Mess', labels: ['Hostel Fee', 'Mess Charges'] },
  { group: 'Living Expenses', labels: ['Living Expenses (Day Scholar)'] },
  { group: 'Books, Internet & Equipment', labels: ['Books & Stationery', 'Internet', 'Uniform / Equipment', 'Laptop (Recommended)'] },
  { group: 'Admission (one-time)', labels: ['Admission Fee'] },
];

function groupForDistribution(categoryTotals: { label: string; amount: number }[]): { label: string; value: number }[] {
  return DISTRIBUTION_GROUPS
    .map(g => ({ label: g.group, value: categoryTotals.filter(c => g.labels.includes(c.label)).reduce((s, c) => s + c.amount, 0) }))
    .filter(g => g.value > 0);
}

export function DashboardSection({ selection }: { selection: PlannerSelection }) {
  const { isAuthenticated, accessToken } = useUserAuth();

  const requestInputs = useMemo(() => ({
    collegeId: selection.collegeId,
    courseId: selection.courseId,
    hostelRequired: selection.hostelRequired,
    accommodationType: selection.accommodationType,
    transportPreference: selection.transportPreference,
    includeLaptop: selection.includeLaptop,
    familyContribution: selection.familyContribution,
    currentSavings: selection.currentSavings,
  }), [
    selection.collegeId, selection.courseId, selection.hostelRequired, selection.accommodationType,
    selection.transportPreference, selection.includeLaptop, selection.familyContribution, selection.currentSavings,
  ]);
  const debounced = useDebouncedValue(requestInputs, 300);

  const [result, setResult] = useState<FinancialDashboardResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    financialApi.getDashboard(debounced, accessToken)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debounced, isAuthenticated, accessToken]);

  if (!isAuthenticated) {
    return (
      <div className="card-editorial" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <p className="text-body" style={{ margin: 0 }}>Sign in to see your personalized dashboard — scholarship savings, ROI, and estimated EMI, matched to your profile.</p>
        <Link href="/login/student" className="btn-editorial-primary">Sign In</Link>
      </div>
    );
  }

  if (isLoading || !result) {
    return <div className="card-editorial colleges-card-skeleton" style={{ minHeight: '300px' }} />;
  }

  const categoryTotals = aggregateByLabel(result);

  const exportCsv = () => downloadCsv('financial-dashboard-summary.csv', [{
    college: selection.collegeName, course: selection.courseName,
    totalEducationCost: result.feeBreakdown.totalProgramCost,
    scholarshipSavings: result.scholarshipSavings.totalEstimatedSavings,
    loanAmount: result.loanAmountNeeded, estimatedEmi: result.estimatedEmi,
    roiPercent: result.roi.roiPercent, paybackYears: result.roi.paybackYears,
    expectedSalaryAfterGraduation: result.expectedSalaryAfterGraduation,
    netFinancialBurden: result.netFinancialBurden,
  }]);

  return (
    <PrintableReport title={`Financial Dashboard — ${selection.courseName} at ${selection.collegeName}`} onExportCsv={exportCsv}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="colleges-stat-grid-2">
        <StatTile label="Total Education Cost" value={formatLakh(result.feeBreakdown.totalProgramCost)} emphasis />
        <StatTile label="Estimated Scholarship Savings" value={formatRupee(result.scholarshipSavings.totalEstimatedSavings)} />
        <StatTile label="Estimated Loan Amount" value={formatRupee(result.loanAmountNeeded)} />
        <StatTile label="Estimated EMI" value={result.estimatedEmi > 0 ? `${formatRupee(result.estimatedEmi)} / mo` : '—'} />
        <StatTile label="Estimated ROI" value={`${result.roi.roiPercent}%`} />
        <StatTile label="Payback Period" value={`${result.roi.paybackYears} yrs`} />
        <StatTile label="Expected Salary After Graduation" value={formatLakh(result.expectedSalaryAfterGraduation)} sub="per year" />
        <StatTile label="Net Financial Burden" value={formatLakh(result.netFinancialBurden)} emphasis />
      </div>

      <div className="card-editorial colleges-section-block">
        <h3 className="font-serif colleges-section-title-sm">Cost Category Summary — {selection.courseName} at {selection.collegeName}</h3>
        <DonutChart data={groupForDistribution(categoryTotals)} />
        <div className="colleges-highlight-grid">
          {categoryTotals.map(c => (
            <div key={c.label} className="colleges-highlight-item">{c.label}: {formatRupee(c.amount)}</div>
          ))}
        </div>
      </div>

      {result.scholarshipSavings.scholarships.length > 0 && (
        <div className="card-editorial colleges-section-block">
          <h3 className="font-serif colleges-section-title-sm">🎓 Matched Scholarships</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {result.scholarshipSavings.scholarships.map((s, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span>{s.name}</span>
                <span style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{formatRupee(s.estimatedSavings)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </PrintableReport>
  );
}
