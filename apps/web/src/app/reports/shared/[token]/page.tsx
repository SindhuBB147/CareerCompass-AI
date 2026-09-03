'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { REPORT_TYPE_LABELS, SharedReportSummary, formatBytes, reportsApi } from '../../../../lib/reports-api';
import { ApiError } from '../../../../lib/api-client';

export default function SharedReportPage() {
  const params = useParams<{ token: string }>();
  const [report, setReport] = useState<SharedReportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reportsApi.getShared(params.token)
      .then(setReport)
      .catch(err => setError(err instanceof ApiError ? err.message : 'This shared report link is invalid, disabled, or has expired.'));
  }, [params.token]);

  if (error) {
    return (
      <div className="section-padding container-editorial">
        <p className="text-body">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="section-padding container-editorial">
        <p className="text-body">Loading shared report…</p>
      </div>
    );
  }

  const downloadUrl = reportsApi.sharedDownloadUrl(params.token);
  const inlineViewable = report.format === 'pdf' || report.format === 'html';

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>Shared Report (Read-Only)</span>
        <h1 className="text-section-title font-serif">{REPORT_TYPE_LABELS[report.reportType]}</h1>
        <p className="text-body">
          {report.format.toUpperCase()} · {formatBytes(report.sizeBytes)} · Generated {new Date(report.generatedAt).toLocaleDateString('en-IN')}
        </p>
        <a href={downloadUrl} download className="btn-editorial-primary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>⬇️ Download Report</a>
      </div>

      {inlineViewable && (
        <div className="reports-html-preview">
          <iframe title="Shared report" src={downloadUrl} className="reports-html-preview-frame" style={{ minHeight: '900px' }} />
        </div>
      )}
    </div>
  );
}
