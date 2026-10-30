'use client';

import type { PhaseInstance } from '../../../lib/roadmap-api';
import { STATUS_COLORS, STATUS_LABELS } from '../roadmap-helpers';

export function CertificationsView({ phases }: { phases: PhaseInstance[] }) {
  const rows = phases.flatMap(p => p.milestones.filter(m => m.certifications.length > 0).flatMap(m => m.certifications.map(c => ({ ...c, milestone: m }))));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p className="text-body">Certifications recommended along your roadmap, grouped by the milestone that targets them.</p>
      <div className="roadmap-card-grid">
        {rows.map((c, idx) => (
          <div key={`${c.name}-${idx}`} className="card-editorial" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span className="roadmap-status-pill" style={{ alignSelf: 'flex-start', color: STATUS_COLORS[c.milestone.status], borderColor: STATUS_COLORS[c.milestone.status] }}>
              {STATUS_LABELS[c.milestone.status]}
            </span>
            <h4 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>{c.name}</h4>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>{c.provider}</p>
            {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', fontSize: '14px' }}>View certification →</a>}
          </div>
        ))}
      </div>
      {rows.length === 0 && <p className="text-body">No certifications on this roadmap yet.</p>}
    </div>
  );
}
