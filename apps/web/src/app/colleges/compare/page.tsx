'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { collegesApi, type College } from '../../../lib/colleges-api';
import { ReportDownloadButton } from '../../../components/ui/ReportDownloadButton';

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} L`;
}

function bestCutoff(college: College): number | null {
  const ranks = college.courses.map((c) => c.cutoffRankSummary).filter((r): r is number => typeof r === 'number');
  return ranks.length ? Math.min(...ranks) : null;
}

function roiMultiple(college: College): string | null {
  const avgPackage = college.placementSummary?.[college.placementSummary.length - 1]?.averagePackage;
  const fee = college.feeBreakdown?.totalAnnualFee;
  if (!avgPackage || !fee) return null;
  return `${((avgPackage * 100000) / fee).toFixed(1)}x`;
}

function CompareCollegesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ids, setIds] = useState<string[]>([]);
  const [colleges, setColleges] = useState<College[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('ids') || '';
    setIds(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }, [searchParams]);

  useEffect(() => {
    if (ids.length < 2) {
      setColleges([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    collegesApi
      .compare(ids)
      .then((res) => {
        if (!cancelled) setColleges(res.colleges);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load comparison.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const removeCollege = (id: string) => {
    const next = ids.filter((i) => i !== id);
    setIds(next);
    router.replace(next.length ? `/colleges/compare?ids=${next.join(',')}` : '/colleges/compare');
  };

  const rows = useMemo(
    () => [
      { label: 'College Type', render: (c: College) => c.collegeType },
      { label: 'NIRF Rank', render: (c: College) => (c.accreditation?.nirfRank ? `#${c.accreditation.nirfRank}` : 'Unranked') },
      { label: 'NAAC Grade', render: (c: College) => c.accreditation?.naac || '—' },
      { label: 'Established', render: (c: College) => c.establishedYear ?? 'Not publicly disclosed' },
      { label: 'Annual Fee', render: (c: College) => formatLakh(c.feeBreakdown?.totalAnnualFee ?? 0) },
      { label: 'Highest Package', render: (c: College) => (c.placementSummary?.length ? `₹${c.placementSummary[c.placementSummary.length - 1].highestPackage} LPA` : 'N/A') },
      { label: 'Average Package', render: (c: College) => (c.placementSummary?.length ? `₹${c.placementSummary[c.placementSummary.length - 1].averagePackage} LPA` : 'N/A') },
      { label: 'Placement %', render: (c: College) => (c.placementSummary?.length ? `${c.placementSummary[c.placementSummary.length - 1].placementPercentage}%` : 'N/A') },
      { label: 'ROI (Avg Package ÷ Fee)', render: (c: College) => roiMultiple(c) ?? 'N/A' },
      { label: 'Best Cutoff Rank', render: (c: College) => (bestCutoff(c) ? `#${bestCutoff(c)}` : 'N/A') },
      { label: 'Hostel', render: (c: College) => (c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel ? 'Available' : 'Not Available') },
      { label: 'Campus Size', render: (c: College) => (c.campusSizeAcres != null ? `${c.campusSizeAcres} Acres` : 'Not publicly disclosed') },
      { label: 'Hostel Amenities', render: (c: College) => c.hostelInfo?.amenities?.length ?? 0 },
      { label: 'Courses Offered', render: (c: College) => c.courses?.map((crc) => crc.name).join(', ') || '—' },
    ],
    [],
  );

  return (
    <div className="section-padding container-editorial colleges-compare-page">
      <div className="colleges-compare-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="text-section-title font-serif">Compare Colleges</h1>
          <p className="text-body">Side-by-side comparison across NIRF, fees, placements, hostel, and course offerings.</p>
        </div>
        <ReportDownloadButton
          reportType="college_comparison"
          params={ids.length >= 2 ? { collegeIds: ids } : undefined}
          tooltip="Download Report"
          size="md"
        />
      </div>

      {ids.length < 2 ? (
        <div className="card-editorial colleges-empty-state">
          <div className="colleges-empty-icon">⚖️</div>
          <h3 className="font-serif colleges-empty-title">Select Colleges to Compare</h3>
          <p className="text-body colleges-empty-desc">
            Pick at least 2 (up to 4) colleges from the directory using the Compare checkbox on each card.
          </p>
          <Link href="/colleges" className="btn-editorial-primary">Browse Colleges</Link>
        </div>
      ) : isLoading ? (
        <div className="card-editorial" style={{ padding: '64px', textAlign: 'center' }}>Loading comparison…</div>
      ) : error ? (
        <div className="card-editorial colleges-empty-state">
          <h3 className="font-serif colleges-empty-title">Could Not Load Comparison</h3>
          <p className="text-body colleges-empty-desc">{error}</p>
          <Link href="/colleges" className="btn-editorial-primary">Back to Colleges</Link>
        </div>
      ) : (
        <div className="colleges-compare-table-wrap">
          <table className="colleges-compare-table">
            <thead>
              <tr>
                <th className="colleges-compare-row-label" />
                {colleges.map((c) => (
                  <th key={c.id || c._id} className="colleges-compare-college-head">
                    <img src={c.logo} alt="" className="colleges-compare-logo" />
                    <Link href={`/colleges/${c.slug}`} className="colleges-compare-name">{c.name}</Link>
                    <span className="colleges-compare-location">{c.city}, {c.state}</span>
                    <button type="button" className="colleges-compare-remove" onClick={() => removeCollege(c.id || c._id)} aria-label={`Remove ${c.name} from comparison`}>
                      Remove
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td className="colleges-compare-row-label">{row.label}</td>
                  {colleges.map((c) => (
                    <td key={(c.id || c._id) + row.label} className="colleges-compare-cell">{row.render(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function CompareCollegesPage() {
  return (
    <Suspense
      fallback={
        <div className="section-padding container-editorial" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading comparison…
        </div>
      }
    >
      <CompareCollegesContent />
    </Suspense>
  );
}
