'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { financialApi, type ProgramFeeBreakdown, type FeeLineItem } from '../../../lib/financial-api';
import { BarChart } from '../../../components/financial/BarChart';
import { PrintableReport } from '../../../components/financial/PrintableReport';
import { downloadCsv } from '../../../lib/csv-export';
import type { PlannerSelection } from './PlannerForm';

function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function SourceBadge({ source }: { source: FeeLineItem['source'] }) {
  return (
    <span className="financial-source-badge" data-source={source}>
      {source === 'db' ? 'Real' : 'Estimated'}
    </span>
  );
}

export function FeeBreakdownView({ selection }: { selection: PlannerSelection }) {
  const requestInputs = useMemo(() => ({
    collegeId: selection.collegeId,
    courseId: selection.courseId,
    hostelRequired: selection.hostelRequired,
    accommodationType: selection.accommodationType,
    transportPreference: selection.transportPreference,
    includeLaptop: selection.includeLaptop,
  }), [selection.collegeId, selection.courseId, selection.hostelRequired, selection.accommodationType, selection.transportPreference, selection.includeLaptop]);
  const debounced = useDebouncedValue(requestInputs, 300);

  const [result, setResult] = useState<ProgramFeeBreakdown | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'yearly' | 'semester'>('yearly');
  const [expandedYear, setExpandedYear] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    financialApi.getFeeBreakdown(debounced)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debounced]);

  if (isLoading || !result) {
    return <div className="card-editorial colleges-card-skeleton" style={{ minHeight: '300px' }} />;
  }

  const currentYear = result.yearly.find(y => y.year === expandedYear) ?? result.yearly[0];

  const exportCsv = () => downloadCsv('fee-breakdown.csv', result.yearly.flatMap(y =>
    y.lineItems.map(li => ({ year: y.year, label: li.label, amount: li.amount, source: li.source, recurring: li.recurring })),
  ));

  return (
    <PrintableReport title={`Fee Breakdown — ${selection.courseName} at ${selection.collegeName}`} onExportCsv={exportCsv}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="colleges-stat-grid-2">
        <div className="colleges-stat-box colleges-stat-box-dark">
          <span className="colleges-stat-box-label">Total Program Cost</span>
          <div className="font-serif colleges-stat-box-value">{formatRupee(result.totalProgramCost)}</div>
        </div>
        <div className="colleges-stat-box">
          <span className="colleges-stat-box-label">Program Duration</span>
          <div className="font-serif colleges-stat-box-value">{result.durationYears} Years</div>
        </div>
        {selection.includeLaptop && (
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Total Cost (incl. laptop)</span>
            <div className="font-serif colleges-stat-box-value">{formatRupee(result.totalProgramCostWithLaptop)}</div>
          </div>
        )}
      </div>

      <div className="card-editorial" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="font-serif" style={{ fontSize: '22px', margin: 0 }}>Fee Breakdown — {selection.courseName} at {selection.collegeName}</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className={viewMode === 'yearly' ? 'btn-editorial-primary' : 'btn-editorial-secondary'} onClick={() => setViewMode('yearly')}>Year-wise</button>
            <button type="button" className={viewMode === 'semester' ? 'btn-editorial-primary' : 'btn-editorial-secondary'} onClick={() => setViewMode('semester')}>Semester-wise</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {result.yearly.map(y => (
            <button
              key={y.year} type="button"
              className={expandedYear === y.year ? 'btn-editorial-primary' : 'btn-editorial-secondary'}
              onClick={() => setExpandedYear(y.year)}
            >
              Year {y.year}
            </button>
          ))}
        </div>

        {viewMode === 'yearly' && (
          <BarChart data={currentYear.lineItems.map(li => ({ label: li.label, value: li.amount }))} height={180} />
        )}

        {viewMode === 'yearly' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentYear.lineItems.map((li, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {li.label} <SourceBadge source={li.source} />
                  {!li.recurring && <span className="badge-editorial" style={{ fontSize: '10px' }}>One-time</span>}
                </span>
                <span style={{ fontWeight: 600 }}>{formatRupee(li.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '17px', paddingTop: '8px' }}>
              <span>Year {currentYear.year} Total</span>
              <span className="font-serif">{formatRupee(currentYear.total)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {[1, 2].map(sem => {
              const semData = result.semesterWise.find(s => s.year === expandedYear && s.semester === sem);
              if (!semData) return null;
              return (
                <div key={sem} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 className="colleges-subheading">Semester {sem}</h4>
                  {semData.lineItems.map((li, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
                      <span>{li.label}</span>
                      <span>{formatRupee(li.amount)}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, paddingTop: '6px', borderTop: '1px solid var(--border-color)' }}>
                    <span>Total</span>
                    <span>{formatRupee(semData.total)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
    </PrintableReport>
  );
}
