'use client';

import React, { useState } from 'react';
import type { College } from '../../../lib/colleges-api';

export interface CompletenessDimension {
  key: string;
  label: string;
  ok: boolean;
}

export interface CompletenessResult {
  dimensions: CompletenessDimension[];
  percent: number;
}

// `cutoffCount` is fetched separately (see [id]/page.tsx) since cutoffs live
// in their own top-level collection, not embedded on the college document —
// null means "still loading", treated as not-yet-satisfied rather than a hard ✕.
export function computeCompleteness(c: College, cutoffCount: number | null): CompletenessResult {
  const dimensions: CompletenessDimension[] = [
    { key: 'info', label: 'College Information', ok: !!(c.name && c.description && (c.contact?.website || c.contact?.phone)) },
    { key: 'courses', label: 'Courses', ok: (c.courses?.length ?? 0) > 0 },
    { key: 'seats', label: 'Seats', ok: (c.courses ?? []).some(course => !!course.seatMatrix && (course.seatMatrix.totalSeats ?? 0) > 0) },
    { key: 'cutoffs', label: 'Cutoffs', ok: (cutoffCount ?? 0) > 0 },
    { key: 'fees', label: 'Fees', ok: !!(c.feeBreakdown?.totalAnnualFee || c.feeBreakdown?.tuitionFee) },
    { key: 'hostel', label: 'Hostel', ok: !!(c.hostelInfo?.boysHostel || c.hostelInfo?.girlsHostel) },
    { key: 'placements', label: 'Placements', ok: (c.placementSummary?.length ?? 0) > 0 },
    { key: 'facilities', label: 'Facilities', ok: (c.campus?.facilities?.length ?? 0) > 0 },
    { key: 'images', label: 'Images', ok: (c.gallery?.length ?? 0) > 0 },
    { key: 'admission', label: 'Admission Information', ok: (c.admissionRoutes?.length ?? 0) > 0 },
  ];
  const percent = Math.round((dimensions.filter(d => d.ok).length / dimensions.length) * 100);
  return { dimensions, percent };
}

export function CompletenessBreakdown({ result }: { result: CompletenessResult }) {
  const [open, setOpen] = useState(false);
  const tone = result.percent === 100 ? 'admin-status-success' : result.percent >= 60 ? 'admin-status-info' : 'admin-status-neutral';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className={`admin-status-badge ${tone}`}
        style={{ cursor: 'pointer', border: 'none' }}
        onClick={() => setOpen(o => !o)}
      >
        Data Completeness: {result.percent}%
      </button>
      {open && (
        <div
          className="card-editorial"
          style={{ position: 'absolute', right: 0, top: '32px', zIndex: 20, minWidth: '240px', padding: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
        >
          {result.dimensions.map(d => (
            <div key={d.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0' }}>
              <span>{d.label}</span>
              <span style={{ color: d.ok ? 'var(--accent-blue)' : '#B4232E', fontWeight: 700 }}>{d.ok ? '✓' : '✕'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
