'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import {
  adminSecurityApi, LoginHistoryRow, SecurityEventRow, ActiveSessionRow, SecurityAnalytics,
} from '../../../lib/admin-api';
import { AdminTable, AdminTableColumn } from '../../../components/admin/AdminTable';
import { StatCard } from '../../../components/admin/StatCard';
import { BarChart, BarChartPoint } from '../../../components/admin/BarChart';

export default function AdminSecurityPage() {
  const { adminToken } = useAdminAuth();

  const [failedLogins, setFailedLogins] = useState<LoginHistoryRow[]>([]);
  const [failedTotal, setFailedTotal] = useState(0);
  const [suspicious, setSuspicious] = useState<LoginHistoryRow[]>([]);
  const [lockedStudents, setLockedStudents] = useState<any[]>([]);
  const [lockedAdmins, setLockedAdmins] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<{ students: ActiveSessionRow[]; admins: ActiveSessionRow[] }>({ students: [], admins: [] });
  const [events, setEvents] = useState<SecurityEventRow[]>([]);
  const [eventsTotal, setEventsTotal] = useState(0);
  const [analytics, setAnalytics] = useState<SecurityAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    Promise.all([
      adminSecurityApi.failedLogins(adminToken, 1, 20),
      adminSecurityApi.suspiciousLogins(adminToken, 1, 20),
      adminSecurityApi.lockedAccounts(adminToken, 1, 20),
      adminSecurityApi.activeSessions(adminToken, 1, 20),
      adminSecurityApi.events(adminToken, page, 20),
      adminSecurityApi.analytics(adminToken, 30),
    ])
      .then(([failed, susp, locked, sessions, evts, ana]) => {
        setFailedLogins(failed.entries); setFailedTotal(failed.totalResults);
        setSuspicious(susp.entries);
        setLockedStudents(locked.students); setLockedAdmins(locked.admins);
        setActiveSessions({ students: sessions.students, admins: sessions.admins });
        setEvents(evts.events); setEventsTotal(evts.totalResults);
        setAnalytics(ana);
      })
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load security data.'))
      .finally(() => setIsLoading(false));
  }, [adminToken, page]);

  useEffect(() => { load(); }, [load]);

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setActionMessage(null);
    try {
      await fn();
      setActionMessage(`✓ ${label}`);
      load();
    } catch (err) {
      setActionMessage(err instanceof ApiError ? `✗ ${err.message}` : `✗ Could not ${label.toLowerCase()}.`);
    } finally {
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleForceLogout = (userId: string, actorType: 'student' | 'admin') =>
    runAction('Session revoked', () => adminSecurityApi.forceLogout(adminToken!, userId, actorType));
  const handleUnlock = (userId: string, actorType: 'student' | 'admin') =>
    runAction('Account unlocked', () => adminSecurityApi.unlock(adminToken!, userId, actorType));
  const handleDisable = (userId: string, actorType: 'student' | 'admin') => {
    const reason = window.prompt('Reason for disabling this account:') ?? undefined;
    return runAction('Account disabled', () => adminSecurityApi.disable(adminToken!, userId, actorType, reason));
  };

  const loginHistoryColumns: AdminTableColumn<LoginHistoryRow>[] = [
    { key: 'timestamp', label: 'When', render: r => new Date(r.timestamp).toLocaleString(), sortable: true, exportValue: r => r.timestamp },
    { key: 'userId', label: 'User ID' },
    { key: 'actorType', label: 'Type' },
    { key: 'status', label: 'Status', render: r => <span className={`admin-status-badge ${r.status === 'success' ? 'admin-status-success' : 'admin-status-danger'}`}>{r.status}</span> },
    { key: 'loginMethod', label: 'Method' },
    { key: 'ip', label: 'IP', render: r => r.ip ?? '—' },
    { key: 'reason', label: 'Reason', render: r => r.failureReason ?? (r.reportedAsUnknown ? 'Reported by user' : '—') },
  ];

  const sessionColumns: AdminTableColumn<ActiveSessionRow>[] = [
    { key: 'user', label: 'User', render: r => r.fullName ?? r.email ?? r.userId },
    { key: 'device', label: 'Device / Browser', render: r => r.session.userAgent ?? 'Unknown' },
    { key: 'ip', label: 'IP', render: r => r.session.ip ?? '—' },
    { key: 'lastUsed', label: 'Last Active', render: r => new Date(r.session.lastUsedAt).toLocaleString() },
  ];

  const eventColumns: AdminTableColumn<SecurityEventRow>[] = [
    { key: 'timestamp', label: 'When', render: r => new Date(r.timestamp).toLocaleString(), sortable: true, exportValue: r => r.timestamp },
    { key: 'action', label: 'Action', render: r => <span className="admin-status-badge admin-status-info">{r.action}</span> },
    { key: 'actorId', label: 'Actor' },
    { key: 'actorType', label: 'Actor Type' },
    { key: 'result', label: 'Result', render: r => <span className={`admin-status-badge ${r.result === 'success' ? 'admin-status-success' : 'admin-status-danger'}`}>{r.result}</span> },
    { key: 'ip', label: 'IP', render: r => r.ip ?? '—' },
  ];

  const browserData: BarChartPoint[] = (analytics?.browserDistribution ?? []).map(d => ({ label: d._id || 'Unknown', value: d.count }));
  const osData: BarChartPoint[] = (analytics?.osDistribution ?? []).map(d => ({ label: d._id || 'Unknown', value: d.count }));
  const failedTrend: BarChartPoint[] = (analytics?.loginTrends ?? [])
    .filter(t => t._id.status === 'failed')
    .map(t => ({ label: t._id.day.slice(5), value: t.count }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Security Management</h1>
          <p className="admin-page-subtitle">Failed logins, locked accounts, suspicious activity, active sessions, and the security audit trail. Super Admin only.</p>
        </div>
      </div>

      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}
      {actionMessage && <div className="admin-inline-message" data-tone={actionMessage.startsWith('✓') ? 'success' : 'error'}>{actionMessage}</div>}

      <div className="admin-kpi-grid">
        <StatCard label="Failed Logins (recent)" value={isLoading ? '—' : failedTotal} />
        <StatCard label="Suspicious Logins" value={isLoading ? '—' : suspicious.length} />
        <StatCard label="Locked Accounts" value={isLoading ? '—' : lockedStudents.length + lockedAdmins.length} />
        <StatCard label="Active Sessions" value={isLoading ? '—' : activeSessions.students.length + activeSessions.admins.length} />
        <StatCard label="Security Events" value={isLoading ? '—' : eventsTotal} />
        <StatCard label="System Security Status" value="Operational" trend="Helmet, rate limiting, and audit logging active" />
      </div>

      <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>Failed Login Trend (30 days)</h2>
        <BarChart data={failedTrend} color="#B4232E" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>Browser Distribution</h2>
          <BarChart data={browserData} />
        </div>
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>OS Distribution</h2>
          <BarChart data={osData} color="#2E8B57" />
        </div>
      </div>

      <div>
        <h2 className="font-serif" style={{ fontSize: '18px', margin: '0 0 12px' }}>Locked Accounts</h2>
        <AdminTable
          columns={[
            { key: 'id', label: 'User ID', render: (r: any) => r._id ?? r.id },
            { key: 'name', label: 'Name / Email', render: (r: any) => r.fullName ?? r.name ?? r.email },
            { key: 'lockedUntil', label: 'Locked Until', render: (r: any) => r.lockedUntil ? new Date(r.lockedUntil).toLocaleString() : '—' },
          ]}
          rows={[...lockedStudents.map(s => ({ ...s, actorType: 'student' })), ...lockedAdmins.map(a => ({ ...a, actorType: 'admin' }))]}
          rowKey={(r: any) => r._id ?? r.id}
          isLoading={isLoading}
          emptyMessage="No locked accounts."
          rowActions={(r: any) => (
            <button className="admin-table-action-btn" onClick={() => handleUnlock(r._id ?? r.id, r.actorType)}>Unlock</button>
          )}
        />
      </div>

      <div>
        <h2 className="font-serif" style={{ fontSize: '18px', margin: '0 0 12px' }}>Active Sessions</h2>
        <AdminTable
          columns={sessionColumns}
          rows={[...activeSessions.students.map(s => ({ ...s, actorType: 'student' as const })), ...activeSessions.admins.map(a => ({ ...a, actorType: 'admin' as const }))]}
          rowKey={r => `${r.userId}-${r.session.sessionId}`}
          isLoading={isLoading}
          emptyMessage="No active sessions."
          rowActions={r => (
            <button className="admin-table-action-btn" data-danger onClick={() => handleForceLogout(r.userId, (r as any).actorType)}>Force Logout</button>
          )}
        />
      </div>

      <div>
        <h2 className="font-serif" style={{ fontSize: '18px', margin: '0 0 12px' }}>Suspicious Logins</h2>
        <AdminTable
          columns={loginHistoryColumns}
          rows={suspicious}
          rowKey={r => r.id || r._id}
          isLoading={isLoading}
          emptyMessage="No suspicious logins detected."
          rowActions={r => (
            <>
              <button className="admin-table-action-btn" onClick={() => handleForceLogout(r.userId, r.actorType)}>Force Logout</button>
              <button className="admin-table-action-btn" data-danger onClick={() => handleDisable(r.userId, r.actorType)}>Disable</button>
            </>
          )}
        />
      </div>

      <div>
        <h2 className="font-serif" style={{ fontSize: '18px', margin: '0 0 12px' }}>Failed Login Attempts</h2>
        <AdminTable columns={loginHistoryColumns} rows={failedLogins} rowKey={r => r.id || r._id} isLoading={isLoading} emptyMessage="No failed login attempts recorded." exportFilename="failed-logins" />
      </div>

      <div>
        <h2 className="font-serif" style={{ fontSize: '18px', margin: '0 0 12px' }}>Security Audit Trail</h2>
        <AdminTable
          columns={eventColumns}
          rows={events}
          rowKey={r => r.id || r._id}
          isLoading={isLoading}
          page={page}
          totalPages={Math.max(1, Math.ceil(eventsTotal / 20))}
          onPageChange={setPage}
          totalCount={eventsTotal}
          exportFilename="security-events"
          emptyMessage="No security events recorded."
        />
      </div>
    </div>
  );
}
