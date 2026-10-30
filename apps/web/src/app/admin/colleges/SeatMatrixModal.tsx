'use client';

import React, { useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCollegesApi } from '../../../lib/admin-api';
import type { CategorySeatBreakdown, Course } from '../../../lib/colleges-api';
import { AdminModal } from '../../../components/admin/AdminModal';

const ROWS: Array<{ key: string; label: string }> = [
  { key: 'gm', label: 'GM' }, { key: 'cat1', label: 'Cat-1' }, { key: 'cat2a', label: '2A' }, { key: 'cat2b', label: '2B' },
  { key: 'cat3a', label: '3A' }, { key: 'cat3b', label: '3B' }, { key: 'sc', label: 'SC' }, { key: 'st', label: 'ST' },
];
const COLS: Array<{ key: string; label: string }> = [{ key: 'g', label: 'General' }, { key: 'r', label: 'Rural' }, { key: 'k', label: 'Kannada Medium' }];

type Grid = Record<string, string>;

function breakdownToGrid(b?: CategorySeatBreakdown | null): Grid {
  const grid: Grid = {};
  if (!b) return grid;
  for (const row of ROWS) for (const col of COLS) {
    const field = `${row.key}_${col.key}` as keyof CategorySeatBreakdown;
    const val = b[field];
    if (typeof val === 'number' && val > 0) grid[`${row.key}_${col.key}`] = String(val);
  }
  return grid;
}

function gridToBreakdown(grid: Grid): Record<string, number> {
  const out: Record<string, number> = {};
  let total = 0;
  for (const row of ROWS) for (const col of COLS) {
    const key = `${row.key}_${col.key}`;
    const val = Number(grid[key]) || 0;
    out[key] = val;
    total += val;
  }
  out.total = total;
  return out;
}

function SeatGrid({ title, grid, onChange }: { title: string; grid: Grid; onChange: (grid: Grid) => void }) {
  return (
    <div>
      <h4 className="font-serif" style={{ margin: '0 0 8px', fontSize: '14px' }}>{title}</h4>
      <div className="admin-table-wrap">
        <table className="admin-table" style={{ fontSize: '12px' }}>
          <thead>
            <tr><th>Category</th>{COLS.map(c => <th key={c.key}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {ROWS.map(row => (
              <tr key={row.key}>
                <td>{row.label}</td>
                {COLS.map(col => {
                  const key = `${row.key}_${col.key}`;
                  return (
                    <td key={col.key}>
                      <input
                        type="number" min={0} className="input-editorial" style={{ width: '70px', padding: '4px 6px', fontSize: '12px' }}
                        value={grid[key] ?? ''} onChange={e => onChange({ ...grid, [key]: e.target.value })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SeatMatrixModal({ collegeId, course, onClose }: { collegeId: string; course: Course; onClose: () => void }) {
  const { adminToken } = useAdminAuth();
  const [academicYear, setAcademicYear] = useState(course.seatMatrix?.academicYear ?? '');
  const [totalSeats, setTotalSeats] = useState(String(course.seatMatrix?.totalSeats ?? course.intake ?? ''));
  const [kkGrid, setKkGrid] = useState<Grid>(breakdownToGrid(course.seatMatrix?.kkSeats));
  const [rkGrid, setRkGrid] = useState<Grid>(breakdownToGrid(course.seatMatrix?.rkSeats));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await adminCollegesApi.updateSeatMatrix(adminToken, collegeId, course.courseId, {
        academicYear: academicYear || undefined,
        totalSeats: Number(totalSeats) || 0,
        kkSeats: gridToBreakdown(kkGrid) as any,
        rkSeats: gridToBreakdown(rkGrid) as any,
      } as any);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save seat matrix.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AdminModal title={`Manage Seats — ${course.name}`} onClose={onClose} onSubmit={handleSubmit} isSubmitting={isSubmitting} error={error} submitLabel="Save Seat Matrix" wide>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '60vh', overflowY: 'auto' }}>
        <div className="admin-form-grid">
          <div className="admin-form-group">
            <label className="admin-form-label">Academic Year</label>
            <input className="input-editorial" value={academicYear} onChange={e => setAcademicYear(e.target.value)} placeholder="2025-26" />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Total Seats</label>
            <input type="number" min={0} className="input-editorial" value={totalSeats} onChange={e => setTotalSeats(e.target.value)} required />
          </div>
        </div>
        <SeatGrid title="KK Seats (Karnataka Kannada Medium candidates)" grid={kkGrid} onChange={setKkGrid} />
        <SeatGrid title="RK Seats (Rest of Karnataka candidates)" grid={rkGrid} onChange={setRkGrid} />
      </div>
    </AdminModal>
  );
}
