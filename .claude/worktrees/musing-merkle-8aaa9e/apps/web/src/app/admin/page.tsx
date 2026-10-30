'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '../../contexts/AdminAuthContext';
import { apiClient, ApiError } from '../../lib/api-client';
import { adminAnalyticsApi, type DashboardMetrics } from '../../lib/admin-api';
import { StatCard } from '../../components/admin/StatCard';
import { BarChart } from '../../components/admin/BarChart';

const QUICK_ACTIONS: Array<{ label: string; icon: string; href?: string }> = [
  { label: 'Add College', icon: '🏛️', href: '/admin/colleges?action=new' },
  { label: 'Add Course', icon: '📚', href: '/admin/colleges' },
  { label: 'Upload Cutoffs', icon: '🎯', href: '/admin/cutoffs?action=upload' },
  { label: 'Add Placement', icon: '💼', href: '/admin/colleges' },
  { label: 'Add Scholarship', icon: '🎓', href: '/admin/scholarships?action=new' },
  { label: 'Update NIRF Ranking', icon: '🏅', href: '/admin/colleges' },
  { label: 'Upload Documents', icon: '📄', href: '/admin/knowledge' },
];

export default function AdminDashboardPage() {
  const { adminToken } = useAdminAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rebuildStatus, setRebuildStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminAnalyticsApi.dashboard(adminToken)
      .then(setMetrics)
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard metrics.'))
      .finally(() => setIsLoading(false));
  }, [adminToken]);

  const handleRebuildKnowledgeBase = async () => {
    if (!adminToken) return;
    setRebuildStatus('Rebuilding…');
    try {
      await apiClient.post('/admin/ai-counsellor/knowledge/reindex', undefined, adminToken);
      setRebuildStatus('✓ Knowledge base rebuilt successfully.');
    } catch (err) {
      setRebuildStatus(err instanceof ApiError ? `✗ ${err.message}` : '✗ Rebuild failed.');
    } finally {
      setTimeout(() => setRebuildStatus(null), 4000);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Dashboard</h1>
          <p className="admin-page-subtitle">Platform-wide metrics across colleges, students, predictions, and AI usage.</p>
        </div>
      </div>

      {error && <div className="admin-inline-message" data-tone="error">{error}</div>}

      <div className="admin-kpi-grid">
        <StatCard label="Total Students" value={isLoading ? '—' : metrics?.totalStudents ?? 0} />
        <StatCard label="Total Colleges" value={isLoading ? '—' : metrics?.totalColleges ?? 0} />
        <StatCard label="Total Courses" value={isLoading ? '—' : metrics?.totalCourses ?? 0} />
        <StatCard label="KCET Colleges" value={isLoading ? '—' : metrics?.kcetColleges ?? 0} />
        <StatCard label="COMEDK Colleges" value={isLoading ? '—' : metrics?.comedkColleges ?? 0} />
        <StatCard label="NEET Colleges" value={isLoading ? '—' : metrics?.neetColleges ?? 0} />
        <StatCard label="Total Predictions" value={isLoading ? '—' : metrics?.totalPredictions ?? 0} />
        <StatCard label="AI Conversations" value={isLoading ? '—' : metrics?.aiCounsellorSessions ?? 0} trend={metrics ? `${(metrics.aiCounsellorEngagementRate * 100).toFixed(0)}% engagement` : undefined} />
        <StatCard label="Scholarships" value={isLoading ? '—' : metrics?.totalScholarships ?? 0} />
        <StatCard label="Active Students (30d)" value={isLoading ? '—' : metrics?.activeStudents30d ?? 0} />
        <StatCard label="New Registrations (7d)" value={isLoading ? '—' : metrics?.newRegistrations7d ?? 0} />
        <StatCard
          label="Pending Reviews"
          value={isLoading ? '—' : (metrics?.pendingCutoffConflicts ?? 0) + (metrics?.flaggedAiConversations ?? 0)}
          trend={metrics ? `${metrics.pendingCutoffConflicts} cutoff conflicts · ${metrics.flaggedAiConversations} flagged chats` : undefined}
        />
      </div>

      <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h3 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>Quick Actions</h3>
        <div className="admin-quick-actions">
          {QUICK_ACTIONS.map(action => (
            <Link key={action.label} href={action.href!} className="admin-quick-action-btn">
              <span>{action.icon}</span> {action.label}
            </Link>
          ))}
          <button type="button" className="admin-quick-action-btn" onClick={handleRebuildKnowledgeBase} style={{ cursor: 'pointer' }}>
            <span>🔄</span> Rebuild AI Knowledge Base
          </button>
        </div>
        {rebuildStatus && <div className="admin-inline-message" data-tone={rebuildStatus.startsWith('✗') ? 'error' : 'success'}>{rebuildStatus}</div>}
      </div>

      <div className="admin-charts-grid">
        <div className="card-editorial admin-chart-card">
          <h4 className="admin-chart-title">Student Registrations (30d)</h4>
          <BarChart data={(metrics?.registrationTrend ?? []).map(t => ({ label: t.date.slice(5), value: t.count }))} />
        </div>
        <div className="card-editorial admin-chart-card">
          <h4 className="admin-chart-title">Prediction Requests (30d)</h4>
          <BarChart data={(metrics?.predictionTrend ?? []).map(t => ({ label: t.date.slice(5), value: t.count }))} color="#1D7A46" />
        </div>
        <div className="card-editorial admin-chart-card">
          <h4 className="admin-chart-title">AI Counsellor Usage (30d)</h4>
          <BarChart data={(metrics?.aiUsageTrend ?? []).map(t => ({ label: t.date.slice(5), value: t.count }))} color="#9A6B00" />
        </div>
        <div className="card-editorial admin-chart-card">
          <h4 className="admin-chart-title">Popular Courses (by prediction volume)</h4>
          <BarChart data={(metrics?.popularCourses ?? []).map(c => ({ label: c.courseId, value: c.count }))} color="#6E4AA0" />
        </div>
        <div className="card-editorial admin-chart-card">
          <h4 className="admin-chart-title">Popular Colleges (by prediction volume)</h4>
          <BarChart data={(metrics?.popularColleges ?? []).map(c => ({ label: c.name, value: c.count }))} color="var(--accent-blue)" />
        </div>
        <div className="card-editorial admin-chart-card">
          <h4 className="admin-chart-title">Registrations by Exam</h4>
          <BarChart data={(metrics?.topExams ?? []).map(e => ({ label: e.examCode, value: e.count }))} color="#B4232E" />
        </div>
      </div>
    </div>
  );
}
