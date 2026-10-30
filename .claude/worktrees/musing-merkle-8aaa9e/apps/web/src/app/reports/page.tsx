'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { ApiError } from '../../lib/api-client';
import { ReportFormat, ReportMetadata, ReportType, reportsApi } from '../../lib/reports-api';
import { ReportCard, ReportCardDef } from './components/ReportCard';
import { ReportHistoryList } from './components/ReportHistoryList';
import { ReportPreviewModal } from './components/ReportPreviewModal';

const REPORT_CARDS: ReportCardDef[] = [
  { key: 'admission_prediction', icon: '📄', title: 'Admission Prediction Report', description: 'Probability bands, ROI, placement estimates, and choice-filling order for your shortlisted colleges.', live: true },
  { key: 'college_comparison', icon: '🏫', title: 'College Comparison Report', description: 'Side-by-side comparison of up to 4 colleges — fees, placements, ROI, and AI recommendation.', live: true },
  { key: 'financial_planning', icon: '💰', title: 'Financial Planning Report', description: 'Fee breakdown, scholarship savings, loan/EMI estimates, and ROI across your shortlist.', live: true },
  { key: 'scholarship_eligibility', icon: '🎓', title: 'Scholarship Eligibility Report', description: 'Every matched scholarship, your eligibility score, and estimated potential savings.', live: true },
  { key: 'career_roadmap', icon: '🛣️', title: 'Career Roadmap Report', description: 'Your semester-wise plan, skills, certifications, and completion progress.', live: true },
  { key: 'ai_recommendation', icon: '🤖', title: 'AI Recommendation Report', description: 'Personalized AI insights across colleges, courses, scholarships, and career strategy.', live: true },
  { key: 'student_progress', icon: '📊', title: 'Student Progress Report', description: 'Profile completion, saved colleges, predictions, scholarships, and roadmap progress at a glance.', live: true },
  { key: 'saved_colleges', icon: '📚', title: 'Saved Colleges Report', description: 'Your wishlist — dream/target/safe colleges with admission probability and financial summary.', live: true },
];

function SignInPrompt() {
  return (
    <div className="card-editorial colleges-empty-state">
      <div className="colleges-empty-icon">📑</div>
      <h3 className="font-serif colleges-empty-title">Sign In to View Your Reports</h3>
      <p className="text-body colleges-empty-desc">Reports are generated from your own profile and platform data — sign in to get started.</p>
    </div>
  );
}

export default function ReportsPage() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();
  const [items, setItems] = useState<ReportMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingKey, setGeneratingKey] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportMetadata | null>(null);

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await reportsApi.list(accessToken, 1, 50);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your reports.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const latestByType = useMemo(() => {
    const map = new Map<ReportType, ReportMetadata>();
    for (const item of items) {
      const existing = map.get(item.reportType);
      if (!existing || new Date(item.generatedAt) > new Date(existing.generatedAt)) map.set(item.reportType, item);
    }
    return map;
  }, [items]);

  const handleGenerate = useCallback(async (reportType: ReportType, format: ReportFormat) => {
    if (!accessToken) return;
    setGeneratingKey(reportType);
    setError(null);
    try {
      const report = await reportsApi.generate(accessToken, reportType, format);
      await refresh();
      setActiveReport(report);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate this report. Make sure you have enough data (e.g. shortlisted colleges) first.');
    } finally {
      setGeneratingKey(null);
    }
  }, [accessToken, refresh]);

  const handleDelete = useCallback(async (report: ReportMetadata) => {
    if (!accessToken) return;
    await reportsApi.remove(accessToken, report.id).catch(() => {});
    await refresh();
  }, [accessToken, refresh]);

  if (authLoading) return null;

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="section-padding container-editorial">
        <SignInPrompt />
      </div>
    );
  }

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>Reports Center</span>
        <h1 className="text-section-title font-serif">Your Reports</h1>
        <p className="text-body" style={{ maxWidth: '640px' }}>
          Generate professional, downloadable reports from your latest profile and platform data — as PDF, Excel, CSV, or printable HTML.
        </p>
      </div>

      {error && <p style={{ color: '#B4232E', fontSize: '14px' }}>{error}</p>}

      <div className="reports-card-grid">
        {REPORT_CARDS.map(def => (
          <ReportCard
            key={def.key}
            def={def}
            latest={def.live ? latestByType.get(def.key as ReportType) : undefined}
            busy={generatingKey === def.key}
            onGenerate={format => handleGenerate(def.key as ReportType, format)}
            onPreview={setActiveReport}
          />
        ))}
      </div>

      <div>
        <h2 className="text-subheading font-serif" style={{ marginBottom: '16px' }}>Report History</h2>
        {loading ? <p className="text-body">Loading…</p> : (
          <ReportHistoryList items={items} onOpen={setActiveReport} onDelete={handleDelete} />
        )}
      </div>

      {activeReport && (
        <ReportPreviewModal
          report={activeReport}
          token={accessToken}
          onClose={() => setActiveReport(null)}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
