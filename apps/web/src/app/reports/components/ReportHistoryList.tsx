'use client';

import { Download, Eye, Share2, Trash2 } from 'lucide-react';
import { ReportMetadata, REPORT_TYPE_LABELS, formatBytes } from '../../../lib/reports-api';

export function ReportHistoryList({
  items,
  onOpen,
  onDownload,
  onShare,
  onDelete,
}: {
  items: ReportMetadata[];
  onOpen: (report: ReportMetadata) => void;
  onDownload: (report: ReportMetadata) => void;
  onShare: (report: ReportMetadata) => void;
  onDelete: (report: ReportMetadata) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="card-editorial colleges-empty-state" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <div className="colleges-empty-icon" style={{ fontSize: '36px', marginBottom: '12px' }}>📁</div>
        <h3 className="font-serif colleges-empty-title" style={{ fontSize: '20px', marginBottom: '8px' }}>No Reports Found</h3>
        <p className="text-body colleges-empty-desc" style={{ fontSize: '14px', maxWidth: '440px', margin: '0 auto' }}>
          You can generate reports directly from inside each feature module (Admission Predictor, Financial Planner, Saved Colleges, etc.) using the download icon.
        </p>
      </div>
    );
  }

  return (
    <div className="card-editorial reports-history-table-wrap" style={{ overflowX: 'auto' }}>
      <table className="reports-history-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
            <th style={{ padding: '12px 16px' }}>Report Type</th>
            <th style={{ padding: '12px 16px' }}>Format</th>
            <th style={{ padding: '12px 16px' }}>Generated Date</th>
            <th style={{ padding: '12px 16px' }}>File Size</th>
            <th style={{ padding: '12px 16px' }}>Downloads</th>
            <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
              <td style={{ padding: '14px 16px', fontWeight: 500 }}>
                {REPORT_TYPE_LABELS[r.reportType] || r.reportType}
              </td>
              <td style={{ padding: '14px 16px' }}>
                <span className="badge-editorial">{r.format.toUpperCase()}</span>
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {new Date(r.generatedAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {formatBytes(r.sizeBytes)}
              </td>
              <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                {r.downloadCount}
              </td>
              <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="reports-link-btn"
                    onClick={() => onOpen(r)}
                    title="View & Preview Report"
                    aria-label="View report preview"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '13px' }}
                  >
                    <Eye size={14} /> Open
                  </button>

                  <button
                    type="button"
                    className="reports-link-btn"
                    onClick={() => onDownload(r)}
                    title="Download Again"
                    aria-label="Download report again"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '13px' }}
                  >
                    <Download size={14} /> Download
                  </button>

                  <button
                    type="button"
                    className="reports-link-btn"
                    onClick={() => onShare(r)}
                    title="Share Report Link"
                    aria-label="Share report"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '13px' }}
                  >
                    <Share2 size={14} /> Share
                  </button>

                  <button
                    type="button"
                    className="reports-link-btn reports-danger-link"
                    onClick={() => onDelete(r)}
                    title="Delete Report"
                    aria-label="Delete report"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '13px', color: '#DC2626' }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
