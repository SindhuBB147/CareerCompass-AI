'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { financialApi, type HostelLivingResult } from '../../../lib/financial-api';
import type { PlannerSelection } from './PlannerForm';

function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

const LIVING_COST_ROWS: { key: keyof HostelLivingResult['estimate']; label: string }[] = [
  { key: 'rentOrHostelMonthly', label: 'Rent / Hostel' },
  { key: 'foodMonthly', label: 'Food & Mess' },
  { key: 'electricityMonthly', label: 'Electricity' },
  { key: 'internetMonthly', label: 'Internet' },
  { key: 'laundryMonthly', label: 'Laundry' },
  { key: 'transportMonthly', label: 'Transportation' },
  { key: 'personalMonthly', label: 'Personal / Daily Expenses' },
  { key: 'medicalMiscMonthly', label: 'Medical & Miscellaneous' },
];

export function HostelLivingView({ selection }: { selection: PlannerSelection }) {
  const accommodationType = selection.hostelRequired ? 'hostel' : selection.accommodationType;
  const requestInputs = useMemo(() => ({
    collegeId: selection.collegeId,
    accommodationType,
    transportPreference: selection.transportPreference,
  }), [selection.collegeId, accommodationType, selection.transportPreference]);
  const debounced = useDebouncedValue(requestInputs, 300);

  const [result, setResult] = useState<HostelLivingResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    financialApi.getHostelLiving(debounced)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  if (isLoading || !result) {
    return <div className="card-editorial colleges-card-skeleton" style={{ minHeight: '300px' }} />;
  }

  return (
    <div className="colleges-two-col">
      <div className="card-editorial colleges-section-block">
        <h3 className="font-serif colleges-section-title-sm">🏠 On-Campus Hostel {result.dbHostelInfo ? '(from college records)' : ''}</h3>
        {result.dbHostelInfo ? (
          <>
            <div className="colleges-stat-grid-2">
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">Hostel Fee / Year</span>
                <div className="font-serif colleges-stat-box-value">{formatRupee(result.dbHostelInfo.hostelFeePerYear)}</div>
              </div>
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">Mess Fee / Year</span>
                <div className="font-serif colleges-stat-box-value">{formatRupee(result.dbHostelInfo.messFeePerYear)}</div>
              </div>
            </div>
            <p className="text-body" style={{ fontSize: '14px' }}>{result.dbHostelInfo.messDetails}</p>
            <div className="colleges-badge-row">
              {result.dbHostelInfo.boysHostel && <span className="badge-editorial">Boys Hostel</span>}
              {result.dbHostelInfo.girlsHostel && <span className="badge-editorial">Girls Hostel</span>}
              <span className="badge-editorial">Capacity: {result.dbHostelInfo.capacity}</span>
            </div>
            <div className="colleges-highlight-grid">
              {result.dbHostelInfo.amenities.map(a => <div key={a} className="colleges-highlight-item">✓ {a}</div>)}
            </div>
          </>
        ) : (
          <p className="text-body">Select a college with on-file hostel information to see real hostel fees and amenities here.</p>
        )}
      </div>

      <div className="card-editorial colleges-section-block">
        <h3 className="font-serif colleges-section-title-sm">💰 Estimated Monthly Living Cost</h3>
        <div className="colleges-stat-box colleges-stat-box-dark">
          <span className="colleges-stat-box-label">Total / Month</span>
          <div className="font-serif colleges-stat-box-value">{formatRupee(result.estimate.totalMonthly)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {LIVING_COST_ROWS.map(row => (
            <div key={row.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span style={{ fontWeight: 500 }}>{formatRupee(result.estimate[row.key] as number)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '15px', paddingTop: '4px' }}>
            <span>Annual Total</span>
            <span className="font-serif">{formatRupee(result.estimate.totalAnnual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
