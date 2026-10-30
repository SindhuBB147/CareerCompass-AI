'use client';

import Link from 'next/link';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { collegesApi, type College } from '../../../lib/colleges-api';
import { financialApi, type FinancialComparisonResult } from '../../../lib/financial-api';
import { PrintableReport } from '../../../components/financial/PrintableReport';
import { downloadCsv } from '../../../lib/csv-export';

function formatRupee(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

interface Pick {
  collegeId: string;
  collegeName: string;
  courseId: string;
  courseName: string;
  courses: College['courses'];
}

const METRIC_ROWS: { key: keyof FinancialComparisonResult['rows'][number]; label: string; format: (v: any) => string }[] = [
  { key: 'totalFees', label: 'Total Fees', format: formatRupee },
  { key: 'hostelCost', label: 'Hostel Cost', format: formatRupee },
  { key: 'totalCost', label: 'Total Cost', format: formatRupee },
  { key: 'scholarshipSavings', label: 'Scholarships', format: formatRupee },
  { key: 'placementPercentage', label: 'Placement %', format: (v: number | null) => v === null ? 'N/A' : `${v}%` },
  { key: 'avgPackage', label: 'Average Salary', format: formatRupee },
  { key: 'highestPackage', label: 'Highest Salary', format: formatRupee },
  { key: 'roiPercent', label: 'ROI', format: (v: number) => `${v}%` },
  { key: 'paybackYears', label: 'Payback Period', format: (v: number) => `${v} yrs` },
  { key: 'loanAmountNeeded', label: 'Loan Requirement', format: formatRupee },
];

export function ComparisonView() {
  const { isAuthenticated, accessToken } = useUserAuth();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [searchResults, setSearchResults] = useState<College[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [hostelRequired, setHostelRequired] = useState(true);

  useEffect(() => {
    if (!debouncedQuery) { setSearchResults([]); return; }
    let cancelled = false;
    collegesApi.search({ q: debouncedQuery, limit: 6 })
      .then(res => { if (!cancelled) setSearchResults(res.results); })
      .catch(() => { if (!cancelled) setSearchResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery]);

  const addCollege = (college: College) => {
    if (picks.length >= 4) return;
    if (picks.some(p => p.collegeId === (college.id || college._id))) return;
    const firstCourse = college.courses[0];
    setPicks(prev => [...prev, {
      collegeId: college.id || college._id, collegeName: college.name,
      courseId: firstCourse?.courseId ?? '', courseName: firstCourse?.name ?? '',
      courses: college.courses,
    }]);
    setQuery('');
    setSearchResults([]);
  };

  const removePick = (collegeId: string) => setPicks(prev => prev.filter(p => p.collegeId !== collegeId));

  const setPickCourse = (collegeId: string, courseId: string) => {
    setPicks(prev => prev.map(p => {
      if (p.collegeId !== collegeId) return p;
      const course = p.courses.find(c => c.courseId === courseId);
      return course ? { ...p, courseId: course.courseId, courseName: course.name } : p;
    }));
  };

  const requestInputs = useMemo(() => ({
    collegeCourseIds: picks.map(p => ({ collegeId: p.collegeId, courseId: p.courseId })),
    hostelRequired,
  }), [picks, hostelRequired]);
  const debouncedRequest = useDebouncedValue(requestInputs, 400);

  const [result, setResult] = useState<FinancialComparisonResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || debouncedRequest.collegeCourseIds.length < 2) { setResult(null); return; }
    let cancelled = false;
    setIsLoading(true);
    financialApi.getComparison(debouncedRequest, accessToken)
      .then(r => { if (!cancelled) setResult(r); })
      .catch(() => { if (!cancelled) setResult(null); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [debouncedRequest, isAuthenticated, accessToken]);

  if (!isAuthenticated) {
    return (
      <div className="card-editorial" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
        <p className="text-body" style={{ margin: 0 }}>Sign in to compare colleges on scholarships, ROI, and estimated loan requirement.</p>
        <Link href="/login/student" className="btn-editorial-primary">Sign In</Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="card-editorial" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <h3 className="font-serif" style={{ fontSize: '20px', margin: 0 }}>Select 2–4 Colleges to Compare</h3>
        <div style={{ position: 'relative' }}>
          <input
            className="input-editorial" placeholder="Search by college name…"
            value={query} onChange={e => setQuery(e.target.value)}
            disabled={picks.length >= 4}
          />
          {searchResults.length > 0 && (
            <div className="card-editorial" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px', padding: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {searchResults.map(c => (
                <button
                  key={c.id || c._id} type="button" onClick={() => addCollege(c)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '14px' }}
                >
                  <strong>{c.name}</strong> <span style={{ color: 'var(--text-muted)' }}>— {c.city}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <label className="colleges-filter-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={hostelRequired} onChange={e => setHostelRequired(e.target.checked)} />
          Compare with hostel accommodation
        </label>

        {picks.length > 0 && (
          <div className="colleges-badge-row">
            {picks.map(p => (
              <span key={p.collegeId} className="badge-editorial" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {p.collegeName}
                <select
                  value={p.courseId} onChange={e => setPickCourse(p.collegeId, e.target.value)}
                  style={{ border: 'none', background: 'none', fontSize: '12px' }}
                >
                  {p.courses.map(c => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}
                </select>
                <button type="button" onClick={() => removePick(p.collegeId)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {picks.length < 2 && (
        <div className="card-editorial colleges-empty-state">
          <div className="colleges-empty-icon">⚖️</div>
          <h3 className="font-serif colleges-empty-title">Add at least 2 colleges</h3>
          <p className="text-body colleges-empty-desc">Search and select up to 4 colleges above to see a side-by-side financial comparison.</p>
        </div>
      )}

      {picks.length >= 2 && (isLoading || !result) && (
        <div className="card-editorial colleges-card-skeleton" style={{ minHeight: '300px' }} />
      )}

      {result && (
        <PrintableReport
          title="College Financial Comparison"
          onExportCsv={() => downloadCsv('college-comparison.csv', result.rows.map(row => ({
            college: row.collegeName, course: row.courseName, totalFees: row.totalFees, hostelCost: row.hostelCost,
            totalCost: row.totalCost, scholarshipSavings: row.scholarshipSavings, placementPercentage: row.placementPercentage,
            avgPackage: row.avgPackage, highestPackage: row.highestPackage, roiPercent: row.roiPercent,
            paybackYears: row.paybackYears, loanAmountNeeded: row.loanAmountNeeded,
          })))}
        >
          <div className="card-editorial" style={{ padding: '28px', overflowX: 'auto' }}>
            <div className="financial-comparison-grid" style={{ ['--cols' as any]: result.rows.length }}>
              <div />
              {result.rows.map(row => (
                <div key={row.collegeId} style={{ fontWeight: 700, fontSize: '14px', padding: '8px', textAlign: 'center' }}>
                  {row.collegeName}<br /><span style={{ fontWeight: 400, fontSize: '12px', color: 'var(--text-muted)' }}>{row.courseName}</span>
                </div>
              ))}
              {METRIC_ROWS.map(metric => (
                <Fragment key={metric.key}>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '8px', borderTop: '1px solid var(--border-color)' }}>{metric.label}</div>
                  {result.rows.map(row => (
                    <div key={`${metric.key}-${row.collegeId}`} style={{ fontSize: '14px', fontWeight: 600, padding: '8px', textAlign: 'center', borderTop: '1px solid var(--border-color)' }}>
                      {metric.format(row[metric.key] as any)}
                    </div>
                  ))}
                </Fragment>
              ))}
            </div>
          </div>
        </PrintableReport>
      )}
    </div>
  );
}
