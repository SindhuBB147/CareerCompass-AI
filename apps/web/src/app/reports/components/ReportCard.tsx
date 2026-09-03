'use client';

import { useState } from 'react';
import { ReportFormat, ReportMetadata, formatBytes } from '../../../lib/reports-api';

export interface ReportCardDef {
  key: string;
  icon: string;
  title: string;
  description: string;
  live: boolean;
}

const FORMAT_OPTIONS: { value: ReportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'csv', label: 'CSV' },
  { value: 'html', label: 'Printable HTML' },
];

export function ReportCard({
  def, latest, busy, onGenerate, onPreview,
}: {
  def: ReportCardDef;
  latest?: ReportMetadata;
  busy: boolean;
  onGenerate: (format: ReportFormat) => void;
  onPreview: (report: ReportMetadata) => void;
}) {
  const [format, setFormat] = useState<ReportFormat>('pdf');

  return (
    <div className="card-editorial reports-card">
      <div className="reports-card-icon">{def.icon}</div>
      <h3 className="font-serif" style={{ fontSize: '18px', margin: '8px 0 4px' }}>{def.title}</h3>
      <p className="text-body" style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{def.description}</p>

      {!def.live && <span className="badge-editorial reports-coming-soon">Coming Soon</span>}

      {def.live && (
        <>
          <div className="reports-card-meta">
            {latest ? (
              <>
                <span>Last generated {new Date(latest.generatedAt).toLocaleDateString('en-IN')}</span>
                <span>{formatBytes(latest.sizeBytes)}</span>
              </>
            ) : (
              <span>Not generated yet</span>
            )}
          </div>

          <div className="reports-card-actions">
            <select className="input-editorial reports-format-select" value={format} onChange={e => setFormat(e.target.value as ReportFormat)} disabled={busy}>
              {FORMAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button type="button" className="btn-editorial-primary reports-btn-sm" onClick={() => onGenerate(format)} disabled={busy}>
              {busy ? 'Generating…' : 'Generate'}
            </button>
          </div>

          {latest && (
            <button type="button" className="reports-link-btn" onClick={() => onPreview(latest)}>
              Preview / Download / Share →
            </button>
          )}
        </>
      )}
    </div>
  );
}
