'use client';
import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../../../lib/api-client';
import type { RankedCollegeResult } from '../types';

interface CollegeDetail {
  name: string;
  hostelInfo?: { amenities?: string[]; boysHostel?: boolean; girlsHostel?: boolean };
  placementSummary?: Array<{ year: number; highestPackage: number; medianPackage: number; averagePackage: number }>;
}

interface Props {
  selected: RankedCollegeResult[];
  onClose: () => void;
  onRemove: (collegeId: string) => void;
}

export function CompareDrawer({ selected, onClose, onRemove }: Props) {
  const [details, setDetails] = useState<Map<string, CollegeDetail>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    // Reuses the existing college comparison endpoint for facility-level
    // detail (highest/median package, hostel amenities) that isn't already
    // in the prediction result — fees/placement-avg/cutoff/scholarships are
    // shown directly from the already-computed prediction results.
    apiClient.post<{ colleges: CollegeDetail[] }>('/colleges/compare', { collegeIds: selected.map(s => s.collegeId) })
      .then(data => {
        const map = new Map<string, CollegeDetail>();
        for (const c of data.colleges) map.set(c.name, c);
        setDetails(map);
      })
      .catch(err => setError(err instanceof ApiError ? err.message : 'Could not load comparison details.'))
      .finally(() => setLoading(false));
  }, [selected]);

  if (selected.length === 0) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div
        className="card-editorial"
        style={{ maxWidth: '1100px', width: '100%', maxHeight: '85vh', overflowY: 'auto', borderRadius: '24px 24px 0 0', padding: '32px' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>Compare Colleges</h3>
          <button onClick={onClose} className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>Close ✕</button>
        </div>

        {selected.length < 2 && <p className="text-body">Select at least 2 colleges to compare.</p>}
        {loading && <p className="text-body">Loading comparison…</p>}
        {error && <div style={{ color: '#B3261E', fontSize: '14px' }}>{error}</div>}

        {selected.length >= 2 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '10px', color: 'var(--text-muted)', fontWeight: 600, minWidth: '140px' }}>Metric</th>
                  {selected.map(r => (
                    <th key={r.collegeId} style={{ textAlign: 'left', padding: '10px', minWidth: '200px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                        <span className="font-serif" style={{ fontSize: '16px' }}>{r.collegeName}</span>
                        <button onClick={() => onRemove(r.collegeId)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>✕</button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Course', get: (r: RankedCollegeResult) => r.courseName },
                  { label: 'NIRF Rank', get: (r: RankedCollegeResult) => r.nirfRank ? `#${r.nirfRank}` : 'Unranked' },
                  { label: 'Admission Probability', get: (r: RankedCollegeResult) => `${r.probabilityPercent}% (${r.probabilityLevel})` },
                  { label: 'Previous Cutoff', get: (r: RankedCollegeResult) => r.previousYearCutoff ? `#${r.previousYearCutoff}` : '—' },
                  { label: 'Fees / year', get: (r: RankedCollegeResult) => r.feePerYear ? `₹${r.feePerYear.toLocaleString('en-IN')}` : '—' },
                  { label: 'Average Package', get: (r: RankedCollegeResult) => r.placementAverage ? `${r.placementAverage} LPA` : '—' },
                  {
                    label: 'Highest Package', get: (r: RankedCollegeResult) => {
                      const d = details.get(r.collegeName);
                      const latest = d?.placementSummary?.sort((a, b) => b.year - a.year)[0];
                      return latest ? `${latest.highestPackage} LPA` : '—';
                    },
                  },
                  {
                    label: 'ROI (fee ÷ package)', get: (r: RankedCollegeResult) => {
                      if (!r.feePerYear || !r.placementAverage) return '—';
                      const totalFee = r.feePerYear * 4;
                      const years = Math.round((totalFee / (r.placementAverage * 100000)) * 10) / 10;
                      return `${years} yrs payback`;
                    },
                  },
                  { label: 'Hostel', get: (r: RankedCollegeResult) => r.hostelAvailable ? 'Available' : 'Not Available' },
                  {
                    label: 'Facilities', get: (r: RankedCollegeResult) => {
                      const d = details.get(r.collegeName);
                      const amenities = d?.hostelInfo?.amenities ?? [];
                      return amenities.length > 0 ? amenities.slice(0, 3).join(', ') : '—';
                    },
                  },
                  { label: 'Scholarships', get: (r: RankedCollegeResult) => `${r.scholarshipsCount} matching` },
                ].map(row => (
                  <tr key={row.label} style={{ borderTop: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>{row.label}</td>
                    {selected.map(r => (
                      <td key={r.collegeId} style={{ padding: '10px' }}>{row.get(r)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
