'use client';

import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCollegesApi } from '../../../lib/admin-api';
import { collegesApi, type College } from '../../../lib/colleges-api';
import { AdminModal } from '../../../components/admin/AdminModal';

interface NewPlacementForm {
  year: string; highestPackage: string; averagePackage: string; medianPackage: string;
  placementPercentage: string; topRecruiters: string;
}

const EMPTY_FORM: NewPlacementForm = {
  year: String(new Date().getFullYear()), highestPackage: '', averagePackage: '', medianPackage: '',
  placementPercentage: '', topRecruiters: '',
};

export function PlacementsManagerModal({ collegeId, onClose }: { collegeId: string; onClose: () => void }) {
  const { adminToken } = useAdminAuth();
  const [college, setCollege] = useState<College | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<NewPlacementForm>(EMPTY_FORM);

  const reload = () => {
    setIsLoading(true);
    collegesApi.getDetail(collegeId).then(setCollege).catch(() => setError('Failed to load placements.')).finally(() => setIsLoading(false));
  };

  useEffect(() => { reload(); }, [collegeId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setError(null);
    const year = Number(form.year);
    const exists = college?.placementSummary.some(p => p.year === year);
    try {
      const payload = {
        year,
        highestPackage: Number(form.highestPackage),
        averagePackage: Number(form.averagePackage),
        medianPackage: Number(form.medianPackage),
        placementPercentage: Number(form.placementPercentage),
        topRecruiters: form.topRecruiters.split(',').map(r => r.trim()).filter(Boolean),
      };
      if (exists) await adminCollegesApi.updatePlacement(adminToken, collegeId, year, payload);
      else await adminCollegesApi.addPlacement(adminToken, collegeId, payload);
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save placement data.');
    }
  };

  return (
    <AdminModal title={`Manage Placements — ${college?.name ?? '…'}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '65vh', overflowY: 'auto' }}>
        {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

        {isLoading ? (
          <p className="admin-loading">Loading…</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Year</th><th>Highest</th><th>Average</th><th>Median</th><th>Placed %</th><th>Top Recruiters</th></tr></thead>
              <tbody>
                {[...college!.placementSummary].reverse().map(p => (
                  <tr key={p.year}>
                    <td>{p.year}</td>
                    <td>₹{p.highestPackage} LPA</td>
                    <td>₹{p.averagePackage} LPA</td>
                    <td>₹{p.medianPackage} LPA</td>
                    <td>{p.placementPercentage}%</td>
                    <td>{p.topRecruiters.slice(0, 3).join(', ')}{p.topRecruiters.length > 3 ? '…' : ''}</td>
                  </tr>
                ))}
                {college?.placementSummary.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No placement data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={handleAdd} className="admin-form-grid" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <p style={{ gridColumn: '1 / -1', fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Enter an existing year to update it, or a new year to add a row.
          </p>
          <div className="admin-form-group">
            <label className="admin-form-label">Year</label>
            <input type="number" className="input-editorial" required value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Placement %</label>
            <input type="number" step="0.1" className="input-editorial" required value={form.placementPercentage} onChange={e => setForm({ ...form, placementPercentage: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Highest Package (LPA)</label>
            <input type="number" step="0.1" className="input-editorial" required value={form.highestPackage} onChange={e => setForm({ ...form, highestPackage: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Average Package (LPA)</label>
            <input type="number" step="0.1" className="input-editorial" required value={form.averagePackage} onChange={e => setForm({ ...form, averagePackage: e.target.value })} />
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">Median Package (LPA)</label>
            <input type="number" step="0.1" className="input-editorial" required value={form.medianPackage} onChange={e => setForm({ ...form, medianPackage: e.target.value })} />
          </div>
          <div className="admin-form-group" data-span="2">
            <label className="admin-form-label">Top Recruiters (comma-separated)</label>
            <input className="input-editorial" value={form.topRecruiters} onChange={e => setForm({ ...form, topRecruiters: e.target.value })} placeholder="Microsoft, Amazon, TCS" />
          </div>
          <div className="admin-form-group" data-span="2" style={{ alignItems: 'flex-end' }}>
            <button type="submit" className="btn-editorial-primary" style={{ padding: '10px 20px', fontSize: '13px' }}>Save Placement Year</button>
          </div>
        </form>
      </div>
    </AdminModal>
  );
}
