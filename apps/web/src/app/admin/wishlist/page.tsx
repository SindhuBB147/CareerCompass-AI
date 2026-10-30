'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminWishlistApi, type AdminSavedCollegeRow, type WishlistAnalytics } from '../../../lib/admin-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { StatCard } from '../../../components/admin/StatCard';
import { BarChart } from '../../../components/admin/BarChart';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';

const BOOKMARK_STATUSES = ['dream', 'target', 'safe', 'backup', 'interested', 'applied', 'admitted', 'rejected'];

const STATUS_TONE: Record<string, string> = {
  admitted: 'admin-status-success',
  applied: 'admin-status-info',
  rejected: 'admin-status-danger',
  dream: 'admin-status-warning',
};

type DatePreset = 'all' | 'today' | '7d' | '30d' | 'year' | 'custom';

function presetToRange(preset: DatePreset, customFrom: string, customTo: string): { dateFrom?: string; dateTo?: string } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
  switch (preset) {
    case 'today': return { dateFrom: startOfDay(now) };
    case '7d': return { dateFrom: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() };
    case '30d': return { dateFrom: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString() };
    case 'year': return { dateFrom: new Date(now.getFullYear(), 0, 1).toISOString() };
    case 'custom': return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
    default: return {};
  }
}

export default function WishlistAdminPage() {
  const { adminToken } = useAdminAuth();

  // Analytics
  const [analytics, setAnalytics] = useState<WishlistAnalytics | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Records table
  const [records, setRecords] = useState<AdminSavedCollegeRow[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoadingRecords, setIsLoadingRecords] = useState(true);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'college_asc' | 'college_desc' | 'student_asc' | 'student_desc'>('newest');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    setIsLoadingAnalytics(true);
    adminWishlistApi.analytics(adminToken)
      .then(setAnalytics)
      .catch((err) => setAnalyticsError(err instanceof ApiError ? err.message : 'Failed to load wishlist analytics.'))
      .finally(() => setIsLoadingAnalytics(false));
  }, [adminToken]);

  const loadRecords = useCallback(() => {
    if (!adminToken) return;
    setIsLoadingRecords(true);
    setRecordsError(null);
    const { dateFrom, dateTo } = presetToRange(datePreset, customFrom, customTo);
    adminWishlistApi.list(adminToken, {
      q: debouncedSearch || undefined,
      status: statusFilter || undefined,
      dateFrom, dateTo,
      sortBy,
      page,
      limit: 20,
    })
      .then((res) => {
        setRecords(res.records);
        setTotalResults(res.totalResults);
        setTotalPages(res.totalPages);
      })
      .catch((err) => {
        setRecords([]);
        setTotalResults(0);
        setRecordsError(err instanceof ApiError ? err.message : 'Unable to load saved colleges.');
      })
      .finally(() => setIsLoadingRecords(false));
  }, [adminToken, debouncedSearch, statusFilter, sortBy, datePreset, customFrom, customTo, page]);

  useEffect(() => { setPage(1); }, [debouncedSearch, statusFilter, sortBy, datePreset, customFrom, customTo]);
  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleRemove = async (row: AdminSavedCollegeRow) => {
    if (!adminToken) return;
    if (!confirm(`Remove "${row.collegeName}" from ${row.studentName}'s saved list?`)) return;
    setRemovingId(row.id);
    try {
      await adminWishlistApi.remove(adminToken, row.userId, row.collegeId);
      loadRecords();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Unable to remove saved college.');
    } finally {
      setRemovingId(null);
    }
  };

  const columns: AdminTableColumn<AdminSavedCollegeRow>[] = [
    { key: 'student', label: 'Student', render: (r) => r.studentName },
    { key: 'email', label: 'Email', render: (r) => r.studentEmail ?? '—' },
    { key: 'college', label: 'College', render: (r) => r.collegeName },
    { key: 'code', label: 'College Code', render: (r) => r.collegeCode ?? '—' },
    { key: 'city', label: 'City', render: (r) => r.city ?? '—' },
    { key: 'status', label: 'Status', render: (r) => <span className={`admin-status-badge ${STATUS_TONE[r.status] ?? 'admin-status-info'}`}>{r.status}</span> },
    { key: 'savedDate', label: 'Saved Date', render: (r) => new Date(r.createdAt).toLocaleDateString(), exportValue: (r) => r.createdAt },
    { key: 'updated', label: 'Last Updated', render: (r) => new Date(r.updatedAt).toLocaleDateString(), exportValue: (r) => r.updatedAt },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Saved Colleges & Wishlist</h1>
          <p className="admin-page-subtitle">Real student wishlist activity — search, filter, and manage individual saved-college records, plus aggregate trends across all students.</p>
        </div>
      </div>

      {analyticsError && <div className="admin-inline-message" data-tone="error">{analyticsError}</div>}

      {isLoadingAnalytics ? (
        <p className="admin-loading">Loading wishlist analytics…</p>
      ) : analytics && (
        <>
          <div className="admin-kpi-grid">
            <StatCard label="Total Saved Colleges" value={String(totalResults)} />
            <StatCard label="Most Saved College" value={analytics.mostSaved[0]?.collegeName ?? '—'} trend={analytics.mostSaved[0] ? `${analytics.mostSaved[0].saves} saves` : undefined} />
            <StatCard label="Trending This Week" value={analytics.trending[0]?.collegeName ?? '—'} trend={analytics.trending[0] ? `${analytics.trending[0].savesLast7Days} saves` : undefined} />
            <StatCard label="Most Popular List" value={analytics.popularLists[0]?.name ?? '—'} trend={analytics.popularLists[0] ? `${analytics.popularLists[0].count} colleges` : undefined} />
          </div>

          <div className="admin-charts-grid">
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Most Saved Colleges</h4>
              <BarChart data={analytics.mostSaved.map((r) => ({ label: r.collegeName, value: r.saves }))} />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Trending (Last 7 Days)</h4>
              <BarChart data={analytics.trending.map((r) => ({ label: r.collegeName, value: r.savesLast7Days }))} color="#1D7A46" />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Most Compared Colleges</h4>
              <BarChart data={analytics.mostCompared.map((r) => ({ label: r.collegeName, value: r.comparisons }))} color="#9A6B00" />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Bookmark Status Breakdown</h4>
              <BarChart data={analytics.bookmarkStatusBreakdown.map((r) => ({ label: r.status, value: r.count }))} color="#6E4AA0" />
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Saved College Records</h3>

        {recordsError && <div className="admin-inline-message" data-tone="error">{recordsError}</div>}

        <AdminTable
          columns={columns}
          rows={records}
          rowKey={(r) => r.id}
          isLoading={isLoadingRecords}
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Search by student, email, college, or code…"
          toolbarActions={
            <>
              <select className="input-editorial" style={{ width: 'auto', padding: '9px 14px', fontSize: '13px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                {BOOKMARK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="input-editorial" style={{ width: 'auto', padding: '9px 14px', fontSize: '13px' }} value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="college_asc">College Name A → Z</option>
                <option value="college_desc">College Name Z → A</option>
                <option value="student_asc">Student Name A → Z</option>
                <option value="student_desc">Student Name Z → A</option>
              </select>
              <select className="input-editorial" style={{ width: 'auto', padding: '9px 14px', fontSize: '13px' }} value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="year">This Year</option>
                <option value="custom">Custom Range</option>
              </select>
              {datePreset === 'custom' && (
                <>
                  <input type="date" className="input-editorial" style={{ width: 'auto', padding: '8px 10px', fontSize: '13px' }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
                  <input type="date" className="input-editorial" style={{ width: 'auto', padding: '8px 10px', fontSize: '13px' }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
                </>
              )}
            </>
          }
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalCount={totalResults}
          exportFilename="saved-colleges"
          emptyMessage={debouncedSearch || statusFilter || datePreset !== 'all' ? 'No saved colleges match your filters.' : 'No saved colleges yet.'}
          rowActions={(row) => (
            <>
              <Link href={`/admin/students?q=${encodeURIComponent(row.studentEmail ?? row.studentName)}`} className="admin-table-action-btn">View Student</Link>
              <Link href={`/admin/colleges/${row.collegeId}`} className="admin-table-action-btn">View College</Link>
              <button
                type="button"
                className="admin-table-action-btn"
                data-danger="true"
                disabled={removingId === row.id}
                onClick={() => handleRemove(row)}
              >
                {removingId === row.id ? 'Removing…' : 'Remove'}
              </button>
            </>
          )}
        />
      </div>
    </div>
  );
}
