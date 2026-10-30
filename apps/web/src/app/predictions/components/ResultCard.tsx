'use client';
import Link from 'next/link';
import { formatCurrency as formatCurrencyShared } from '@career-compass/utils';
import { PROBABILITY_COLORS } from '../constants';
import type { RankedCollegeResult } from '../types';
import { onCollegeImageError } from '../../../lib/college-image';

interface Props {
  result: RankedCollegeResult;
  selected: boolean;
  onToggleCompare: (comparisonId: string) => void;
  compareDisabled: boolean;
}

const formatCurrency = (n: number | null) => n === null ? '—' : formatCurrencyShared(n);
const formatRank = (n: number | null) => n === null ? '—' : `#${n.toLocaleString('en-IN')}`;

export function ResultCard({ result, selected, onToggleCompare, compareDisabled }: Props) {
  const color = PROBABILITY_COLORS[result.probabilityLevel] ?? 'var(--text-primary)';

  return (
    <div className="card-editorial" style={{ padding: '28px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      {result.collegeImage && (
        <img
          src={result.collegeImage}
          onError={onCollegeImageError}
          alt={result.collegeName}
          loading="lazy"
          decoding="async"
          style={{ width: '96px', height: '96px', borderRadius: '14px', objectFit: 'cover', flexShrink: 0 }}
        />
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span className="badge-editorial">{result.nirfRank ? `NIRF #${result.nirfRank}` : 'NIRF Unranked'}</span>
              <span className="badge-editorial">{result.collegeType}</span>
              <span className="badge-editorial">{result.discipline}</span>
            </div>
            <h3 className="font-serif" style={{ fontSize: '22px', margin: '10px 0 2px' }}>{result.collegeName}</h3>
            <p style={{ color: 'var(--accent-blue)', fontWeight: 600, fontSize: '15px', margin: 0 }}>{result.courseName}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0' }}>{result.city}{result.district && result.district !== result.city ? `, ${result.district}` : ''}</p>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', cursor: compareDisabled && !selected ? 'not-allowed' : 'pointer' }}>
            <input
              type="checkbox"
              checked={selected}
              disabled={compareDisabled && !selected}
              onChange={() => onToggleCompare(`${result.collegeId}::${result.courseId}`)}
            />
            Compare
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div className="font-serif" style={{ fontSize: '20px', color, maxWidth: '300px' }}>{result.probabilityLevel}</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color }}>Historical cutoff comparison · no probability estimated</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>Your rank #{result.rationale.studentRank.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {result.historicalCutoffs.length > 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            <strong>Verified historical cutoff evidence:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
              {result.historicalCutoffs.map((cutoff, index) => (
                <li key={`${cutoff.year}-${cutoff.round}-${cutoff.category}-${index}`}>
                  {cutoff.year} Round {cutoff.round}{cutoff.phase ? ` Phase ${cutoff.phase}` : ''} · {cutoff.category} seat type · closing rank #{cutoff.closingRank.toLocaleString('en-IN')}
                  {cutoff.sourceCollegeCode ? ` · COMEDK college ${cutoff.sourceCollegeCode}` : ''}
                  {cutoff.sourceBranchCode ? ` · branch ${cutoff.sourceBranchCode}` : ''}
                  {cutoff.sourceUrl && <> · <a href={cutoff.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>official source PDF</a></>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {result.branches && result.branches.length > 0 && (
          <details style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px 16px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-primary)' }}>
              Branch-wise cutoff comparison ({result.branches.length})
            </summary>
            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Branch</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Closing rank</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Student rank</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Admission probability</th>
                    <th style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {result.branches.map((branch) => (
                    <tr key={branch.courseId}>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{branch.courseName}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{formatRank(branch.previousYearCutoff)}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>#{result.rationale.studentRank.toLocaleString('en-IN')}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{branch.probabilityPercent === null ? 'Not estimated' : `${branch.probabilityPercent}%`}</td>
                      <td style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>{branch.probabilityLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '8px 0 0' }}>
              Each row uses that branch’s own cutoff records. Probabilities are shown only when the prediction engine supplies one.
            </p>
          </details>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Previous Cutoff:</span> <strong>{formatRank(result.previousYearCutoff)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Fees / yr:</span> <strong>{formatCurrency(result.feePerYear)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Placement Avg:</span> <strong>{result.placementAverage ? `${result.placementAverage} LPA` : '—'}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Hostel:</span> <strong>{result.hostelAvailable ? 'Available' : 'Not Available'}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Scholarships:</span> <strong>{result.scholarshipsCount} matching</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Confidence:</span> <strong style={{ textTransform: 'capitalize' }}>{result.rationale.confidenceLevel}</strong></div>
        </div>

        <div>
          <Link href={`/colleges/${result.collegeId}`} className="btn-editorial-secondary" style={{ padding: '10px 22px', fontSize: '13px' }}>
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
