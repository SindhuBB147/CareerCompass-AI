import React, { useState } from 'react';
import type { SeatMatrix, CategorySeatBreakdown } from '../../lib/colleges-api';

interface SeatMatrixViewProps {
  seatMatrix: SeatMatrix;
  courseName: string;
}

const CATEGORY_LABELS: Array<{ key: string; label: string }> = [
  { key: 'gm', label: 'General Merit (GM)' },
  { key: 'sc', label: 'Scheduled Caste (SC)' },
  { key: 'st', label: 'Scheduled Tribe (ST)' },
  { key: 'cat1', label: 'Category-1' },
  { key: 'cat2a', label: 'Category-2A' },
  { key: 'cat2b', label: 'Category-2B' },
  { key: 'cat3a', label: 'Category-3A' },
  { key: 'cat3b', label: 'Category-3B' },
];

const SPECIAL_QUOTA_LABELS: Record<string, string> = {
  opn: 'Open Quota (OPN)',
  mc1: 'Minority Quota',
  ph: 'Physically Handicapped (PH)',
  ncc: 'NCC Cadets',
  sports: 'Sports Quota',
  scouts_guides: 'Scouts & Guides',
  defence: 'Defence Quota',
  defence_karnataka: 'Defence (Karnataka)',
  defence_ex_defence: 'Ex-Servicemen Defence',
  anglo_indian: 'Anglo Indian',
  capf: 'CAPF Personnel',
  xcapf: 'Ex-CAPF Personnel',
  gmph: 'GM Disabled (GMPH)',
};

export const SeatMatrixView: React.FC<SeatMatrixViewProps> = ({ seatMatrix, courseName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuota, setSelectedQuota] = useState<'RK' | 'KK'>('RK');

  const kkTotal = seatMatrix.kkSeats?.total ?? 0;
  const rkTotal = seatMatrix.rkSeats?.total ?? 0;
  const specialQuotas = seatMatrix.specialQuotaSeats ?? {};
  const hasSpecial = Object.keys(specialQuotas).length > 0;

  const currentBreakdown: CategorySeatBreakdown | null | undefined =
    selectedQuota === 'KK' ? seatMatrix.kkSeats : seatMatrix.rkSeats;

  return (
    <div className="colleges-seat-matrix-block" style={{ marginTop: '0.75rem', borderTop: '1px border-subtle', paddingTop: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text-title, #1e293b)' }}>
            📊 KEA Seat Matrix {seatMatrix.academicYear ? `(${seatMatrix.academicYear})` : ''}
          </span>
          <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary, #64748b)', marginTop: '0.125rem' }}>
            Total Seats: <strong>{seatMatrix.totalSeats}</strong> • RK: <strong>{rkTotal}</strong> • KK (371J): <strong>{kkTotal}</strong>
          </div>
        </div>
        <button
          type="button"
          className="btn-editorial-secondary"
          style={{ padding: '0.25rem 0.625rem', fontSize: '0.8125rem', borderRadius: '4px' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? '▲ Hide Breakdown' : '▼ View Category Seats'}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--color-bg-secondary, #f8fafc)', borderRadius: '6px' }}>
          {/* Quota Tabs */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <button
              type="button"
              className={`colleges-pill ${selectedQuota === 'RK' ? 'active' : ''}`}
              style={{
                padding: '0.25rem 0.75rem',
                cursor: 'pointer',
                background: selectedQuota === 'RK' ? 'var(--color-accent, #2563eb)' : '#e2e8f0',
                color: selectedQuota === 'RK' ? '#ffffff' : '#334155',
                fontWeight: 600,
                border: 'none',
                borderRadius: '4px',
              }}
              onClick={() => setSelectedQuota('RK')}
            >
              Residual Karnataka (RK) [{rkTotal} Seats]
            </button>
            {kkTotal > 0 && (
              <button
                type="button"
                className={`colleges-pill ${selectedQuota === 'KK' ? 'active' : ''}`}
                style={{
                  padding: '0.25rem 0.75rem',
                  cursor: 'pointer',
                  background: selectedQuota === 'KK' ? 'var(--color-accent, #2563eb)' : '#e2e8f0',
                  color: selectedQuota === 'KK' ? '#ffffff' : '#334155',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                }}
                onClick={() => setSelectedQuota('KK')}
              >
                Kalyana Karnataka (KK 371J) [{kkTotal} Seats]
              </button>
            )}
          </div>

          {/* Category Seat Table */}
          {currentBreakdown ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="colleges-cutoff-table" style={{ width: '100%', fontSize: '0.8125rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#cbd5e1', textTransform: 'uppercase', fontSize: '0.75rem' }}>
                    <th style={{ padding: '0.375rem 0.5rem', textAlign: 'left' }}>Category</th>
                    <th style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>General (G)</th>
                    <th style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>Rural (R)</th>
                    <th style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>Kannada (K)</th>
                    <th style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>Category Total</th>
                  </tr>
                </thead>
                <tbody>
                  {CATEGORY_LABELS.map(({ key, label }) => {
                    const g = (currentBreakdown as any)[`${key}_g`] || 0;
                    const r = (currentBreakdown as any)[`${key}_r`] || 0;
                    const k = (currentBreakdown as any)[`${key}_k`] || 0;
                    const catTotal = g + r + k;
                    return (
                      <tr key={key} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '0.375rem 0.5rem', fontWeight: 500 }}>{label}</td>
                        <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>{g || '-'}</td>
                        <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>{r || '-'}</td>
                        <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>{k || '-'}</td>
                        <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>{catTotal || '-'}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: '#e2e8f0', fontWeight: 'bold' }}>
                    <td style={{ padding: '0.375rem 0.5rem' }}>Subtotal ({selectedQuota})</td>
                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>
                      {CATEGORY_LABELS.reduce((sum, { key }) => sum + ((currentBreakdown as any)[`${key}_g`] || 0), 0)}
                    </td>
                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>
                      {CATEGORY_LABELS.reduce((sum, { key }) => sum + ((currentBreakdown as any)[`${key}_r`] || 0), 0)}
                    </td>
                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>
                      {CATEGORY_LABELS.reduce((sum, { key }) => sum + ((currentBreakdown as any)[`${key}_k`] || 0), 0)}
                    </td>
                    <td style={{ padding: '0.375rem 0.5rem', textAlign: 'center' }}>{currentBreakdown.total}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: '#64748b' }}>No seat breakdown specified for this quota.</div>
          )}

          {/* Special Quota Reservations */}
          {hasSpecial && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.5rem', borderTop: '1px dashed #cbd5e1' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#475569' }}>
                Special Quota & Special Reservations:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.375rem' }}>
                {Object.entries(specialQuotas).map(([key, val]) => (
                  <span
                    key={key}
                    style={{
                      fontSize: '0.75rem',
                      background: '#f1f5f9',
                      border: '1px solid #cbd5e1',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '4px',
                      color: '#1e293b',
                    }}
                  >
                    <strong>{SPECIAL_QUOTA_LABELS[key] || key.toUpperCase()}:</strong> {val} seats
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
