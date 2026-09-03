'use client';
import Link from 'next/link';
import type { RankedCollegeResult } from '../types';

interface Props {
  result: RankedCollegeResult;
  selected: boolean;
  onToggleCompare: (collegeId: string) => void;
  compareDisabled: boolean;
}

const formatCurrency = (n: number | null) => n === null ? '—' : `₹${n.toLocaleString('en-IN')}`;
const formatRank = (n: number | null) => n === null ? '—' : `#${n.toLocaleString('en-IN')}`;

const PORTFOLIO_COLORS: Record<string, string> = {
  SAFE: '#10B981',
  TARGET: '#F59E0B',
  DREAM: '#3B82F6',
  OUTSIDE_HISTORICAL_RANGE: '#EF4444',
  INSUFFICIENT_DATA: '#6B7280',
};

export function ResultCard({ result, selected, onToggleCompare, compareDisabled }: Props) {
  const classification = result.portfolioClassification || 'TARGET';
  const color = PORTFOLIO_COLORS[classification] ?? 'var(--text-primary)';
  const fitScore = result.recommendationFitScore ?? result.probabilityPercent ?? 0;

  return (
    <div className="card-editorial" style={{ padding: '28px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      {result.collegeImage && (
        <img
          src={result.collegeImage}
          alt={result.collegeName}
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
              onChange={() => onToggleCompare(result.collegeId)}
            />
            Compare
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '16px 20px', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
          <div className="font-serif" style={{ fontSize: '32px', color }}>{fitScore}/100</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, color }}>{classification} Portfolio Fit</div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '2px 0 0' }}>
              Expected closing rank {formatRank(result.expectedClosingRank)} · Your rank #{result.rationale.studentRank.toLocaleString('en-IN')}
            </p>
          </div>
        </div>

        {result.reasons && result.reasons.length > 0 && (
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {result.reasons.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>✓</span> <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '13px' }}>
          <div><span style={{ color: 'var(--text-muted)' }}>Previous Cutoff:</span> <strong>{formatRank(result.previousYearCutoff)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Fees / yr:</span> <strong>{formatCurrency(result.feePerYear)}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Placement Avg:</span> <strong>{result.placementAverage ? `${result.placementAverage} LPA` : '—'}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Hostel:</span> <strong>{result.hostelAvailable ? 'Available' : 'Not Available'}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Scholarships:</span> <strong>{result.scholarshipsCount} matching</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Confidence:</span> <strong style={{ textTransform: 'capitalize' }}>{result.rationale.confidenceLevel}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>ML Forecast:</span> <strong>{result.forecastStatus === 'AVAILABLE' ? formatRank(result.predictedClosingRank) : 'Forecast Not Available'}</strong></div>
          <div><span style={{ color: 'var(--text-muted)' }}>Forecast Status:</span> <strong>{result.forecastStatus === 'AVAILABLE' ? 'Available' : 'Forecast Not Available'}</strong></div>
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
