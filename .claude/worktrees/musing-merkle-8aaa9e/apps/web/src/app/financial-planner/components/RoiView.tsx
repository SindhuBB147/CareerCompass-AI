'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { financialApi, type FinancialDashboardResult } from '../../../lib/financial-api';
import { StatTile } from '../../../components/financial/StatTile';
import { LineChart } from '../../../components/financial/LineChart';
import { PrintableReport } from '../../../components/financial/PrintableReport';
import { downloadCsv } from '../../../lib/csv-export';
import type { PlannerSelection } from './PlannerForm';

function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}
function formatLakh(n: number): string {
  return `₹${(n / 100000).toFixed(2)} L`;
}

// Mirrors the backend's ROI_DEFAULTS (8% CAGR over 10 years, see
// apps/api/.../financial-planning/utils/financial-config.ts) — used here
// purely to render a year-by-year salary trajectory for the chart; the
// authoritative roiPercent/paybackYears figures still come from the API.
const SALARY_GROWTH_RATE = 0.08;
const HORIZON_YEARS = 10;

export function RoiView({ selection }: { selection: PlannerSelection }) {
  const { isAuthenticated, accessToken } = useUserAuth();

  const requestInputs = useMemo(() => ({
    collegeId: selection.collegeId,
    courseId: selection.courseId,
    hostelRequired: selection.hostelRequired,
    accommodationType: selection.accommodationType,
    transportPreference: selection.transportPreference,
  }), [selection.collegeId, selection.courseId, selection.hostelRequired, selection.accommodationType, selection.transportPreference]);
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
        <p className="text-body" style={{ margin: 0 }}>Sign in to see your personalized ROI — expected salary, payback period, and long-term return on investment.</p>
        <Link href="/login/student" className="btn-editorial-primary">Sign In</Link>
      </div>
    );
  }

  if (isLoading || !result) {
    return <div className="card-editorial colleges-card-skeleton" style={{ minHeight: '260px' }} />;
  }

  const { roi } = result;
  const salaryTimeline = Array.from({ length: HORIZON_YEARS }, (_, i) => ({
    label: `Yr ${i + 1}`,
    value: Math.round(roi.projectedPackageAnnual * Math.pow(1 + SALARY_GROWTH_RATE, i)),
  }));

  const exportCsv = () => downloadCsv('roi-report.csv', [{
    college: selection.collegeName, course: selection.courseName,
    roiPercent: roi.roiPercent, paybackYears: roi.paybackYears, netCost: roi.netCost,
    totalInvestment: roi.totalInvestment, expectedStartingSalary: roi.projectedPackageAnnual,
    highestPackage: roi.highestPackageAnnual, placementPercentage: roi.placementPercentage,
    durationYears: roi.durationYears,
  }]);

  return (
    <PrintableReport title={`ROI Report — ${selection.courseName} at ${selection.collegeName}`} onExportCsv={exportCsv}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="colleges-stat-grid-2">
        <StatTile label="Estimated ROI" value={`${roi.roiPercent}%`} emphasis sub={`over ${HORIZON_YEARS} years`} />
        <StatTile label="Payback Period" value={`${roi.paybackYears} yrs`} />
        <StatTile label="Net Cost (after scholarships)" value={formatRupee(roi.netCost)} />
        <StatTile label="Total Investment" value={formatRupee(roi.totalInvestment)} />
        <StatTile label="Expected Starting Salary" value={formatLakh(roi.projectedPackageAnnual)} sub="per year" />
        <StatTile label="Highest Package on Record" value={formatLakh(roi.highestPackageAnnual)} sub="per year" />
        <StatTile label="Placement Rate" value={roi.placementPercentage !== null ? `${roi.placementPercentage}%` : 'N/A'} />
        <StatTile label="Program Duration" value={`${roi.durationYears} yrs`} />
      </div>

      <div className="card-editorial colleges-section-block">
        <h3 className="font-serif colleges-section-title-sm">📈 Projected Salary Growth (assumes {SALARY_GROWTH_RATE * 100}% annual growth)</h3>
        <LineChart data={salaryTimeline} height={220} />
      </div>
    </div>
    </PrintableReport>
  );
}
