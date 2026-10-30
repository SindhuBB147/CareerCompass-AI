'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { wishlistApi, type ComparedCollege } from '../../../lib/wishlist-api';
import { PrintableReport } from '../../../components/financial/PrintableReport';
import { downloadCsv } from '../../../lib/csv-export';

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} L`;
}

function bestCutoff(c: ComparedCollege['college']): number | null {
  const ranks = c.courses.map((course) => course.cutoffRankSummary).filter((r): r is number => typeof r === 'number');
  return ranks.length ? Math.min(...ranks) : null;
}

function WishlistCompareContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();

  const [ids, setIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<ComparedCollege[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    const raw = searchParams.get('ids') || '';
    setIds(raw.split(',').map((s) => s.trim()).filter(Boolean));
  }, [searchParams]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || ids.length < 2) { setEntries([]); setIsLoading(false); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    wishlistApi.compare(ids, undefined, accessToken)
      .then((res) => { if (!cancelled) setEntries(res.colleges); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load comparison.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [ids, isAuthenticated, accessToken]);

  const removeCollege = (id: string) => {
    const next = ids.filter((i) => i !== id);
    setIds(next);
    router.replace(next.length ? `/wishlist/compare?ids=${next.join(',')}` : '/wishlist/compare');
  };

  const handleShare = async () => {
    const { token } = await wishlistApi.createShare({ kind: 'comparison', collegeIds: ids }, accessToken);
    const url = `${window.location.origin}/wishlist/shared/${token}`;
    setShareUrl(url);
    try { await navigator.clipboard.writeText(url); } catch { /* clipboard permission denied — URL still shown on screen */ }
  };

  const handleExportCsv = () => {
    downloadCsv('wishlist-comparison', entries.map(({ college: c, enrichment: e }) => ({
      Name: c.name, Type: c.collegeType, City: c.city, NIRF: c.accreditation?.nirfRank ?? '',
      'Annual Fee': c.feeBreakdown?.totalAnnualFee ?? '', Hostel: c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel ? 'Yes' : 'No',
      'Admission Probability %': e.admissionProbability ?? '', 'ROI %': e.roiPercent ?? '', 'Scholarships Eligible': e.scholarshipEligible ? 'Yes' : 'No',
      'Best Cutoff Rank': bestCutoff(c) ?? '',
    })));
  };

  const rows = useMemo(() => [
    { label: 'College Type', render: (e: ComparedCollege) => e.college.collegeType },
    { label: 'NIRF Rank', render: (e: ComparedCollege) => (e.college.accreditation?.nirfRank ? `#${e.college.accreditation.nirfRank}` : 'Unranked') },
    { label: 'Annual Fee', render: (e: ComparedCollege) => formatLakh(e.college.feeBreakdown?.totalAnnualFee ?? 0) },
    { label: 'Highest Package', render: (e: ComparedCollege) => (e.college.placementSummary?.length ? `₹${e.college.placementSummary[e.college.placementSummary.length - 1].highestPackage} LPA` : 'N/A') },
    { label: 'Average Package', render: (e: ComparedCollege) => (e.college.placementSummary?.length ? `₹${e.college.placementSummary[e.college.placementSummary.length - 1].averagePackage} LPA` : 'N/A') },
    { label: 'Placement %', render: (e: ComparedCollege) => (e.enrichment.placementPercentage != null ? `${e.enrichment.placementPercentage}%` : 'N/A') },
    { label: 'Admission Probability', render: (e: ComparedCollege) => (e.enrichment.admissionProbability != null ? `${e.enrichment.admissionProbability}% (${e.enrichment.admissionProbabilityBand})` : 'Not calculated — run a prediction') },
    { label: 'ROI', render: (e: ComparedCollege) => (e.enrichment.roiPercent != null ? `${e.enrichment.roiPercent}%` : 'Not calculated') },
    { label: 'Scholarships', render: (e: ComparedCollege) => (e.enrichment.scholarshipEligible ? `Eligible for ${e.enrichment.scholarshipCount}` : 'None matched') },
    { label: 'Best Cutoff Rank', render: (e: ComparedCollege) => (bestCutoff(e.college) ? `#${bestCutoff(e.college)}` : 'N/A') },
    { label: 'Hostel', render: (e: ComparedCollege) => (e.college.hostelInfo?.boysHostel || e.college.hostelInfo?.girlsHostel ? 'Available' : 'Not Available') },
    { label: 'Infrastructure', render: (e: ComparedCollege) => `${e.college.campusSizeAcres} Acres, ${e.college.facultyCount} Faculty` },
    { label: 'Facilities', render: (e: ComparedCollege) => e.college.hostelInfo?.amenities?.join(', ') || '—' },
  ], []);

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="section-padding container-editorial colleges-compare-page">
      <div className="colleges-compare-header">
        <h1 className="text-section-title font-serif">Compare Your Saved Colleges</h1>
        <p className="text-body">Side-by-side across NIRF, fees, placements, ROI, admission probability, and scholarships.</p>
      </div>

      {ids.length < 2 ? (
        <div className="card-editorial colleges-empty-state">
          <div className="colleges-empty-icon">⚖️</div>
          <h3 className="font-serif colleges-empty-title">Select Colleges to Compare</h3>
          <p className="text-body colleges-empty-desc">Pick at least 2 (up to 4) saved colleges from your Wishlist using the Compare checkbox.</p>
          <Link href="/wishlist" className="btn-editorial-primary">Go to Wishlist</Link>
        </div>
      ) : isLoading ? (
        <div className="card-editorial" style={{ padding: '64px', textAlign: 'center' }}>Loading comparison…</div>
      ) : error ? (
        <div className="card-editorial colleges-empty-state">
          <h3 className="font-serif colleges-empty-title">Could Not Load Comparison</h3>
          <p className="text-body colleges-empty-desc">{error}</p>
          <Link href="/wishlist" className="btn-editorial-primary">Back to Wishlist</Link>
        </div>
      ) : (
        <PrintableReport title="Wishlist Comparison" onExportCsv={handleExportCsv}>
          <div className="wishlist-share-row financial-no-print">
            <button type="button" className="btn-editorial-secondary" onClick={handleShare}>🔗 Copy Share Link</button>
            {shareUrl && <span className="wishlist-share-url">{shareUrl}</span>}
          </div>
          <div className="colleges-compare-table-wrap">
            <table className="colleges-compare-table">
              <thead>
                <tr>
                  <th className="colleges-compare-row-label" />
                  {entries.map((e) => (
                    <th key={e.college.id || e.college._id} className="colleges-compare-college-head">
                      <img src={e.college.logo} alt="" className="colleges-compare-logo" />
                      <Link href={`/colleges/${e.college.slug}`} className="colleges-compare-name">{e.college.name}</Link>
                      <span className="colleges-compare-location">{e.college.city}, {e.college.state}</span>
                      <button type="button" className="colleges-compare-remove financial-no-print" onClick={() => removeCollege(e.college.id || e.college._id)} aria-label={`Remove ${e.college.name} from comparison`}>
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
                    {entries.map((e) => (
                      <td key={(e.college.id || e.college._id) + row.label} className="colleges-compare-cell">{row.render(e)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PrintableReport>
      )}
    </div>
  );
}

export default function WishlistComparePage() {
  return (
    <Suspense fallback={<div className="section-padding container-editorial" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading comparison…</div>}>
      <WishlistCompareContent />
    </Suspense>
  );
}
