'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { adminAuditLogsApi, type AuditLogEntry } from '../../../lib/admin-api';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';

export default function AuditLogsPage() {
  const { adminToken } = useAdminAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [targetCollection, setTargetCollection] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminAuditLogsApi.list(adminToken, { targetCollection: targetCollection || undefined, page, limit: 25 })
      .then(res => { setLogs(res.logs); setTotalResults(res.totalResults); setTotalPages(Math.max(1, Math.ceil(res.totalResults / 25))); })
      .catch(() => { setLogs([]); setTotalResults(0); })
      .finally(() => setIsLoading(false));
  }, [adminToken, targetCollection, page]);

  useEffect(() => { setPage(1); }, [targetCollection]);
  useEffect(() => { load(); }, [load]);

  const columns: AdminTableColumn<AuditLogEntry>[] = [
    { key: 'timestamp', label: 'When', render: l => new Date(l.timestamp).toLocaleString(), sortable: true, exportValue: l => l.timestamp },
    { key: 'action', label: 'Action', render: l => <span className="admin-status-badge admin-status-info">{l.action}</span> },
    { key: 'targetCollection', label: 'Collection', render: l => l.targetCollection },
    { key: 'targetId', label: 'Target ID' },
    { key: 'adminId', label: 'Admin ID' },
    { key: 'ip', label: 'IP', render: l => l.ipAddress ?? '—' },
    { key: 'details', label: 'Details', render: l => (
      <button className="admin-table-action-btn" onClick={() => setExpanded(expanded === (l.id || l._id) ? null : (l.id || l._id))}>
        {expanded === (l.id || l._id) ? 'Hide' : 'View'}
      </button>
    ) },
  ];

  const expandedLog = logs.find(l => (l.id || l._id) === expanded);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Audit Logs</h1>
          <p className="admin-page-subtitle">Every admin create/update/delete action, with before/after snapshots. Super Admin only.</p>
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={logs}
        rowKey={l => l.id || l._id}
        isLoading={isLoading}
        toolbarActions={
          <select className="input-editorial" style={{ width: 'auto', padding: '9px 14px', fontSize: '13px' }} value={targetCollection} onChange={e => setTargetCollection(e.target.value)}>
            <option value="">All Collections</option>
            <option value="colleges">Colleges</option>
            <option value="cutoffs">Cutoffs</option>
            <option value="adminusers">Admin Users</option>
            <option value="notifications">Notifications</option>
            <option value="wishlist">Wishlist</option>
          </select>
        }
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={totalResults}
        exportFilename="audit-logs"
        emptyMessage="No audit log entries match this filter."
      />

      {expandedLog && (
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 className="font-serif" style={{ fontSize: '16px', margin: 0 }}>Snapshot — {expandedLog.action}</h3>
          <div className="admin-form-grid">
            <div>
              <div className="admin-form-label">Before</div>
              <pre style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', fontSize: '12px', overflowX: 'auto' }}>
                {JSON.stringify(expandedLog.beforeSnapshot ?? null, null, 2)}
              </pre>
            </div>
            <div>
              <div className="admin-form-label">After</div>
              <pre style={{ background: 'var(--bg-main)', padding: '12px', borderRadius: '10px', fontSize: '12px', overflowX: 'auto' }}>
                {JSON.stringify(expandedLog.afterSnapshot ?? null, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
