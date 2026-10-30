'use client';

import { useEffect, useState } from 'react';
import {
  ReportMetadata, REPORT_TYPE_LABELS, formatBytes, downloadAuthenticated, fetchPreviewHtml,
  reportsApi, ShareResult,
} from '../../../lib/reports-api';
import { ApiError } from '../../../lib/api-client';
import { ReportShareDialog } from './ReportShareDialog';

export function ReportPreviewModal({
  report, token, onClose, onChanged,
}: {
  report: ReportMetadata;
  token: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [share, setShare] = useState<ShareResult | null>(null);
  const [emailTo, setEmailTo] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    setHtml(null);
    if (report.format === 'html') {
      fetchPreviewHtml(token, report.id).then(setHtml).catch(() => setError('Could not load preview.'));
    }
  }, [report.id, report.format, token]);

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = () => runAction(async () => {
    await downloadAuthenticated(reportsApi.downloadUrl(report.id), token, `${report.reportType}-${report.id}.${report.format}`);
  });

  const handleShare = () => runAction(async () => {
    setShare(await reportsApi.createShare(token, report.id));
  });

  const handleDisableShare = () => runAction(async () => {
    await reportsApi.disableShare(token, report.id);
    setShare(null);
  });

  const handleEmail = () => runAction(async () => {
    await reportsApi.email(token, report.id, emailTo || undefined);
    setEmailSent(true);
  });

  const handleRegenerate = () => runAction(async () => {
    await reportsApi.regenerate(token, report.id);
    onChanged();
    onClose();
  });

  const handleDelete = () => runAction(async () => {
    await reportsApi.remove(token, report.id);
    onChanged();
    onClose();
  });

  return (
    <div className="reports-modal-overlay" onClick={onClose}>
      <div className="card-editorial reports-modal" onClick={e => e.stopPropagation()}>
        <div className="reports-modal-header">
          <h2 className="font-serif" style={{ fontSize: '20px', margin: 0 }}>{REPORT_TYPE_LABELS[report.reportType]}</h2>
          <button type="button" className="reports-link-btn" onClick={onClose}>✕ Close</button>
        </div>

        <p className="text-body" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
          {report.format.toUpperCase()} · {formatBytes(report.sizeBytes)} · Generated {new Date(report.generatedAt).toLocaleString('en-IN')} · Downloaded {report.downloadCount}×
        </p>

        {report.format === 'html' && (
          <div className="reports-html-preview">
            {html ? <iframe title="Report preview" srcDoc={html} className="reports-html-preview-frame" /> : <p className="text-body">Loading preview…</p>}
          </div>
        )}

        {error && <p style={{ color: '#B4232E', fontSize: '13px' }}>{error}</p>}

        <div className="reports-modal-actions">
          <button type="button" className="btn-editorial-primary reports-btn-sm" onClick={handleDownload} disabled={busy}>⬇️ Download</button>
          <button type="button" className="btn-editorial-secondary reports-btn-sm" onClick={() => window.print()} disabled={busy}>🖨️ Print</button>
          <button type="button" className="btn-editorial-secondary reports-btn-sm" onClick={handleShare} disabled={busy}>🔗 Share</button>
          <button type="button" className="btn-editorial-secondary reports-btn-sm" onClick={handleRegenerate} disabled={busy}>♻️ Regenerate</button>
          <button type="button" className="reports-link-btn reports-danger-link" onClick={handleDelete} disabled={busy}>🗑️ Delete</button>
        </div>

        {share && <ReportShareDialog share={share} onDisable={handleDisableShare} onClose={() => setShare(null)} />}

        <div className="reports-email-row">
          <input
            className="input-editorial" placeholder="Email address (optional — defaults to your account email)"
            value={emailTo} onChange={e => setEmailTo(e.target.value)} disabled={busy}
          />
          <button type="button" className="btn-editorial-secondary reports-btn-sm" onClick={handleEmail} disabled={busy}>
            {emailSent ? 'Sent ✓' : 'Email Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
