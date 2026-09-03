'use client';

import { ReportMetadata, REPORT_TYPE_LABELS, formatBytes } from '../../../lib/reports-api';

export function ReportHistoryList({
  items, onOpen, onDelete,
}: {
  items: ReportMetadata[];
  onOpen: (report: ReportMetadata) => void;
  onDelete: (report: ReportMetadata) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="card-editorial colleges-empty-state">
        <div className="colleges-empty-icon">📁</div>
        <h3 className="font-serif colleges-empty-title">No Reports Yet</h3>
        <p className="text-body colleges-empty-desc">Generate your first report above — every report you create is saved here for later.</p>
      </div>
    );
  }

  return (
    <div className="card-editorial reports-history-table-wrap">
      <table className="reports-history-table">
        <thead>
          <tr>
            <th>Report</th>
            <th>Format</th>
            <th>Generated</th>
            <th>Size</th>
            <th>Downloads</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(r => (
            <tr key={r.id}>
              <td>{REPORT_TYPE_LABELS[r.reportType]}</td>
              <td><span className="badge-editorial">{r.format.toUpperCase()}</span></td>
              <td>{new Date(r.generatedAt).toLocaleDateString('en-IN')}</td>
              <td>{formatBytes(r.sizeBytes)}</td>
              <td>{r.downloadCount}</td>
              <td className="reports-history-actions">
                <button type="button" className="reports-link-btn" onClick={() => onOpen(r)}>Open</button>
                <button type="button" className="reports-link-btn reports-danger-link" onClick={() => onDelete(r)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
