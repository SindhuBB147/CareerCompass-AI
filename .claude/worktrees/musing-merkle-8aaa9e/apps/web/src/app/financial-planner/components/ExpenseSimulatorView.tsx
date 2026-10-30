'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { financialApi, type FinancialDashboardResult, type HostelLivingResult } from '../../../lib/financial-api';
import type { PlannerSelection } from './PlannerForm';

function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const COMPARISON_CITIES = ['Bengaluru', 'Mysuru', 'Ballari'];

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="financial-simulator-toggle" data-active={active || undefined} onClick={onClick}>
      {children}
    </button>
  );
}

export function ExpenseSimulatorView({ selection }: { selection: PlannerSelection }) {
  const { isAuthenticated, accessToken } = useUserAuth();

  // With-hostel vs without-hostel is fetched as two parallel dashboards so
  // the delta is a real, backend-computed number, not eyeballed.
  const collegeInputs = useMemo(() => ({ collegeId: selection.collegeId, courseId: selection.courseId }), [selection.collegeId, selection.courseId]);
  const debouncedCollege = useDebouncedValue(collegeInputs, 300);

  const [withHostel, setWithHostel] = useState<FinancialDashboardResult | null>(null);
  const [withoutHostel, setWithoutHostel] = useState<FinancialDashboardResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hostelOn, setHostelOn] = useState(true);
  const [scholarshipApplied, setScholarshipApplied] = useState(true);
  const [selfFunded, setSelfFunded] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) { setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([
      financialApi.getDashboard({ ...debouncedCollege, hostelRequired: true }, accessToken),
      financialApi.getDashboard({ ...debouncedCollege, hostelRequired: false, accommodationType: 'day_scholar' }, accessToken),
    ])
      .then(([h, nh]) => { if (!cancelled) { setWithHostel(h); setWithoutHostel(nh); } })
      .catch(() => { if (!cancelled) { setWithHostel(null); setWithoutHostel(null); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedCollege, isAuthenticated, accessToken]);

  const [cityLiving, setCityLiving] = useState<Record<string, HostelLivingResult>>({});
  useEffect(() => {
    let cancelled = false;
    Promise.all(COMPARISON_CITIES.map(city => financialApi.getHostelLiving({ city, accommodationType: 'day_scholar' })))
      .then(results => { if (!cancelled) setCityLiving(Object.fromEntries(COMPARISON_CITIES.map((c, i) => [c, results[i]]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="card-editorial" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <p className="text-body" style={{ margin: 0 }}>Sign in to simulate different what-if scenarios for your selected college.</p>
        <Link href="/login/student" className="btn-editorial-primary">Sign In</Link>
      </div>
    );
  }

  if (isLoading || !withHostel || !withoutHostel) {
    return <div className="card-editorial colleges-card-skeleton" style={{ minHeight: '260px' }} />;
  }

  const active = hostelOn ? withHostel : withoutHostel;
  const totalCost = active.feeBreakdown.totalProgramCost;
  const costWithScholarship = totalCost - active.scholarshipSavings.totalEstimatedSavings;
  const displayedCost = scholarshipApplied ? costWithScholarship : totalCost;

  const hostelDelta = withHostel.feeBreakdown.totalProgramCost - withoutHostel.feeBreakdown.totalProgramCost;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="card-editorial" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h3 className="font-serif" style={{ fontSize: '20px', margin: 0 }}>What-If Scenarios — {selection.courseName} at {selection.collegeName}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <div className="colleges-filter-label" style={{ marginBottom: '8px' }}>Accommodation</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <ToggleChip active={hostelOn} onClick={() => setHostelOn(true)}>With Hostel</ToggleChip>
              <ToggleChip active={!hostelOn} onClick={() => setHostelOn(false)}>Without Hostel (Day Scholar)</ToggleChip>
            </div>
          </div>
          <div>
            <div className="colleges-filter-label" style={{ marginBottom: '8px' }}>Scholarships</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <ToggleChip active={scholarshipApplied} onClick={() => setScholarshipApplied(true)}>Applied</ToggleChip>
              <ToggleChip active={!scholarshipApplied} onClick={() => setScholarshipApplied(false)}>Not Applied</ToggleChip>
            </div>
          </div>
          <div>
            <div className="colleges-filter-label" style={{ marginBottom: '8px' }}>Funding</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <ToggleChip active={!selfFunded} onClick={() => setSelfFunded(false)}>Education Loan</ToggleChip>
              <ToggleChip active={selfFunded} onClick={() => setSelfFunded(true)}>Self-Funded</ToggleChip>
            </div>
          </div>
        </div>

        <div className="colleges-stat-grid-2">
          <div className="colleges-stat-box colleges-stat-box-dark">
            <span className="colleges-stat-box-label">Total Cost (this scenario)</span>
            <div className="font-serif colleges-stat-box-value">{formatRupee(displayedCost)}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">{selfFunded ? 'Pay Upfront' : 'Estimated EMI'}</span>
            <div className="font-serif colleges-stat-box-value">
              {selfFunded ? formatRupee(displayedCost) : (active.estimatedEmi > 0 ? `${formatRupee(active.estimatedEmi)}/mo` : '₹0/mo')}
            </div>
          </div>
        </div>

        <div className="text-body" style={{ fontSize: '14px' }}>
          Hostel adds <strong>{formatRupee(Math.abs(hostelDelta))}</strong> to the total program cost compared to day-scholar. Scholarships currently save <strong>{formatRupee(active.scholarshipSavings.totalEstimatedSavings)}</strong>.
        </div>
      </div>

      <div className="card-editorial colleges-section-block">
        <h3 className="font-serif colleges-section-title-sm">🏙️ Living Cost by City (day-scholar estimate)</h3>
        <div className="colleges-stat-grid-2">
          {COMPARISON_CITIES.map(city => (
            <div key={city} className="colleges-stat-box">
              <span className="colleges-stat-box-label">{city}</span>
              <div className="font-serif colleges-stat-box-value">
                {cityLiving[city] ? formatRupee(cityLiving[city].estimate.totalAnnual) : '…'}
              </div>
              <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.75 }}>per year</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
