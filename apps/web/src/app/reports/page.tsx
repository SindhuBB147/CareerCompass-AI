'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter } from 'lucide-react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { ApiError } from '../../lib/api-client';
import {
  downloadAuthenticated, ReportMetadata, REPORT_TYPE_LABELS, ReportType, reportsApi,
} from '../../lib/reports-api';
import { ReportHistoryList } from './components/ReportHistoryList';
import { ReportPreviewModal } from './components/ReportPreviewModal';
import { ReportShareDialog } from './components/ReportShareDialog';

const MODULE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Modules' },
  { value: 'admission_prediction', label: 'Admission Predictor' },
  { value: 'college_comparison', label: 'College Comparison' },
  { value: 'financial_planning', label: 'Financial Planner' },
  { value: 'scholarship_eligibility', label: 'Scholarship Module' },
  { value: 'career_roadmap', label: 'Career Roadmap' },
  { value: 'saved_colleges', label: 'Saved Colleges' },
  { value: 'ai_recommendation', label: 'AI Counsellor' },
  { value: 'student_progress', label: 'Student Profile' },
];

function SignInPrompt() {
  return (
    <div className="card-editorial colleges-empty-state" style={{ padding: '64px 24px', textAlign: 'center' }}>
      <div className="colleges-empty-icon" style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
      <h3 className="font-serif colleges-empty-title" style={{ fontSize: '24px', marginBottom: '8px' }}>Sign In to View Your Reports</h3>
      <p className="text-body colleges-empty-desc" style={{ fontSize: '15px', maxWidth: '420px', margin: '0 auto 24px' }}>
        Report history is tied to your personal student account — sign in to view and download previously generated reports.
      </p>
    </div>
  );
}

export default function ReportsPage() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();
  const [items, setItems] = useState<ReportMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReport, setActiveReport] = useState<ReportMetadata | null>(null);
  const [shareReport, setShareReport] = useState<ReportMetadata | null>(null);
  const [shareResult, setShareResult] = useState<any>(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');

  const refresh = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const result = await reportsApi.list(accessToken, 1, 100);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your report history.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleDelete = useCallback(async (report: ReportMetadata) => {
    if (!accessToken) return;
    try {
      await reportsApi.remove(accessToken, report.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete report.');
    }
  }, [accessToken, refresh]);

  const handleDownloadAgain = useCallback(async (report: ReportMetadata) => {
    if (!accessToken) return;
    try {
      const filename = `${report.reportType}-${report.id}.${report.format}`;
      await downloadAuthenticated(reportsApi.downloadUrl(report.id), accessToken, filename);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download report.');
    }
  }, [accessToken, refresh]);

  const handleShare = useCallback(async (report: ReportMetadata) => {
    if (!accessToken) return;
    try {
      const res = await reportsApi.createShare(accessToken, report.id);
      setShareReport(report);
      setShareResult(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to generate share link.');
    }
  }, [accessToken]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesModule = selectedModule === 'all' || item.reportType === selectedModule;
      const label = (REPORT_TYPE_LABELS[item.reportType] || item.reportType).toLowerCase();
      const query = searchQuery.toLowerCase().trim();
      const matchesQuery = !query || label.includes(query) || item.format.toLowerCase().includes(query);
      return matchesModule && matchesQuery;
    });
  }, [items, selectedModule, searchQuery]);

  if (authLoading) return null;

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="section-padding container-editorial">
        <SignInPrompt />
      </div>
    );
  }

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '28px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
          Account · Reports History
        </span>
        <h1 className="text-section-title font-serif" style={{ margin: 0 }}>My Reports</h1>
        <p className="text-body" style={{ maxWidth: '680px' }}>
          Access, download, share, and manage all your previously generated reports. To generate new reports, simply use the download icon located in each feature module header.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '8px', fontSize: '14px' }}>
          {error}
        </div>
      )}

      {/* Controls: Search & Module Filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input-editorial"
              placeholder="Search reports by title or format..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '40px', width: '100%' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
          <Filter size={16} style={{ color: 'var(--text-muted)' }} />
          <select
            className="input-editorial"
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            style={{ padding: '10px 16px', cursor: 'pointer' }}
          >
            {MODULE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* History List */}
      {loading ? (
        <p className="text-body">Loading your reports history…</p>
      ) : (
        <ReportHistoryList
          items={filteredItems}
          onOpen={setActiveReport}
          onDownload={handleDownloadAgain}
          onShare={handleShare}
          onDelete={handleDelete}
        />
      )}

      {/* Preview Modal */}
      {activeReport && (
        <ReportPreviewModal
          report={activeReport}
          token={accessToken}
          onClose={() => setActiveReport(null)}
          onChanged={refresh}
        />
      )}

      {/* Share Dialog */}
      {shareResult && (
        <ReportShareDialog
          share={shareResult}
          onClose={() => { setShareReport(null); setShareResult(null); }}
          onDisable={() => {
            if (shareReport && accessToken) {
              reportsApi.disableShare(accessToken, shareReport.id).catch(() => {});
            }
            setShareReport(null);
            setShareResult(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
