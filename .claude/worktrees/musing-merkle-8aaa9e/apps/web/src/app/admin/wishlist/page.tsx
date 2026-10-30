'use client';

import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminWishlistApi, type WishlistAnalytics } from '../../../lib/admin-api';
import { StatCard } from '../../../components/admin/StatCard';
import { BarChart } from '../../../components/admin/BarChart';

export default function WishlistAnalyticsAdminPage() {
  const { adminToken } = useAdminAuth();
  const [data, setData] = useState<WishlistAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminWishlistApi.analytics(adminToken)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load wishlist analytics.'))
      .finally(() => setIsLoading(false));
  }, [adminToken]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Saved Colleges & Wishlist</h1>
          <p className="admin-page-subtitle">Most-saved and trending colleges, comparison activity, and popular lists across all students.</p>
        </div>
      </div>

      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

      {isLoading ? (
        <p className="admin-loading">Loading wishlist analytics…</p>
      ) : data && (
        <>
          <div className="admin-kpi-grid">
            <StatCard label="Most Saved College" value={data.mostSaved[0]?.collegeName ?? '—'} trend={data.mostSaved[0] ? `${data.mostSaved[0].saves} saves` : undefined} />
            <StatCard label="Trending This Week" value={data.trending[0]?.collegeName ?? '—'} trend={data.trending[0] ? `${data.trending[0].savesLast7Days} saves` : undefined} />
            <StatCard label="Most Compared" value={data.mostCompared[0]?.collegeName ?? '—'} trend={data.mostCompared[0] ? `${data.mostCompared[0].comparisons} comparisons` : undefined} />
            <StatCard label="Most Popular List" value={data.popularLists[0]?.name ?? '—'} trend={data.popularLists[0] ? `${data.popularLists[0].count} colleges` : undefined} />
          </div>

          <div className="admin-charts-grid">
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Most Saved Colleges</h4>
              <BarChart data={data.mostSaved.map((r) => ({ label: r.collegeName, value: r.saves }))} />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Trending (Last 7 Days)</h4>
              <BarChart data={data.trending.map((r) => ({ label: r.collegeName, value: r.savesLast7Days }))} color="#1D7A46" />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Most Compared Colleges</h4>
              <BarChart data={data.mostCompared.map((r) => ({ label: r.collegeName, value: r.comparisons }))} color="#9A6B00" />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Bookmark Status Breakdown</h4>
              <BarChart data={data.bookmarkStatusBreakdown.map((r) => ({ label: r.status, value: r.count }))} color="#6E4AA0" />
            </div>
          </div>

          <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Popular Lists</h3>
            <table className="admin-table">
              <thead>
                <tr><th>List Name</th><th>Colleges</th></tr>
              </thead>
              <tbody>
                {data.popularLists.map((row) => (
                  <tr key={row.name}><td>{row.name}</td><td>{row.count}</td></tr>
                ))}
                {data.popularLists.length === 0 && (
                  <tr><td colSpan={2} className="admin-chart-empty">No lists created yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
