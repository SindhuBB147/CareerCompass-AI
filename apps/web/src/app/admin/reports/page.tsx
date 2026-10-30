'use client';

import React, { useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminReportsApi, type PlatformReport } from '../../../lib/admin-api';
import { downloadCsv } from '../../../lib/csv-export';
import { StatCard } from '../../../components/admin/StatCard';
import { BarChart } from '../../../components/admin/BarChart';

export default function ReportsAdminPage() {
  const { adminToken } = useAdminAuth();
  const [report, setReport] = useState<PlatformReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [examCode, setExamCode] = useState('KCET');
  const [cohort, setCohort] = useState<{ totalStudents: number; rankDistribution: Array<{ bucket: string; count: number }> } | null>(null);
  const [isLoadingCohort, setIsLoadingCohort] = useState(false);

  useEffect(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminReportsApi.platform(adminToken)
      .then(setReport)
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load platform report.'))
      .finally(() => setIsLoading(false));
  }, [adminToken]);

  const loadCohort = () => {
    if (!adminToken) return;
    setIsLoadingCohort(true);
    adminReportsApi.cohort(adminToken, examCode)
      .then(res => setCohort(res))
      .catch(() => setCohort(null))
      .finally(() => setIsLoadingCohort(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCohort(); }, [adminToken, examCode]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Reports</h1>
          <p className="admin-page-subtitle">Platform-wide and exam-cohort reports, exportable as CSV.</p>
        </div>
        {report && (
          <button
            className="btn-editorial-secondary"
            style={{ padding: '9px 18px', fontSize: '13px' }}
            onClick={() => downloadCsv('platform-report', [
              { metric: 'Total Registered', value: report.userMetrics.totalRegistered },
              { metric: 'Active In Period', value: report.userMetrics.activeInPeriod },
              { metric: 'New Registrations', value: report.userMetrics.newRegistrations },
              { metric: 'Predictions Computed', value: report.predictionMetrics.totalComputed },
              { metric: 'Notifications Sent', value: report.notificationMetrics.totalSent },
              { metric: 'Delivery Success Rate', value: report.notificationMetrics.deliverySuccessRate },
              { metric: 'Cutoff Records', value: report.cutoffMetrics.totalRecords },
            ])}
          >
            ⬇ Export Platform Report CSV
          </button>
        )}
      </div>

      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

      {isLoading ? (
        <p className="admin-loading">Loading report…</p>
      ) : report && (
        <>
          <div className="admin-kpi-grid">
            <StatCard label="Total Registered" value={report.userMetrics.totalRegistered} />
            <StatCard label="Active (Period)" value={report.userMetrics.activeInPeriod} />
            <StatCard label="New Registrations" value={report.userMetrics.newRegistrations} />
            <StatCard label="Predictions Computed" value={report.predictionMetrics.totalComputed} />
            <StatCard label="Notifications Sent" value={report.notificationMetrics.totalSent} trend={`${(report.notificationMetrics.deliverySuccessRate * 100).toFixed(0)}% delivered`} />
            <StatCard label="Cutoff Records" value={report.cutoffMetrics.totalRecords} />
            <StatCard label="Open Conflicts" value={report.cutoffMetrics.conflictsOpen} />
          </div>

          <div className="admin-charts-grid">
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Students by Exam</h4>
              <BarChart data={report.userMetrics.byExam.map(e => ({ label: e.examCode, value: e.count }))} />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Students by Category</h4>
              <BarChart data={report.userMetrics.byCategory.map(c => ({ label: c.category, value: c.count }))} color="#1D7A46" />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Prediction Band Distribution</h4>
              <BarChart data={report.predictionMetrics.bandDistribution.map(b => ({ label: b.band, value: b.count }))} color="#9A6B00" />
            </div>
            <div className="card-editorial admin-chart-card">
              <h4 className="admin-chart-title">Notifications by Channel</h4>
              <BarChart data={report.notificationMetrics.byChannel.map(c => ({ label: c.channel, value: c.count }))} color="#6E4AA0" />
            </div>
          </div>
        </>
      )}

      <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Cohort Report by Exam</h3>
          <select className="input-editorial" style={{ width: 'auto', padding: '9px 14px', fontSize: '13px' }} value={examCode} onChange={e => setExamCode(e.target.value)}>
            <option value="KCET">KCET</option>
            <option value="COMEDK">COMEDK</option>
            <option value="NEET">NEET</option>
          </select>
        </div>
        {isLoadingCohort ? (
          <p className="admin-loading">Loading…</p>
        ) : cohort ? (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{cohort.totalStudents} students registered for {examCode}.</p>
            <BarChart data={cohort.rankDistribution.map(b => ({ label: b.bucket, value: b.count }))} color="var(--accent-blue)" />
          </>
        ) : <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No cohort data available.</p>}
      </div>
    </div>
  );
}
