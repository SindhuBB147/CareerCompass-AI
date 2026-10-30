'use client';

import { useMemo } from 'react';
import type { PhaseInstance, ProjectRef } from '../../../lib/roadmap-api';
import { STATUS_COLORS, STATUS_LABELS } from '../roadmap-helpers';

const LEVEL_LABELS: Record<ProjectRef['level'], string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced', industry: 'Industry',
  open_source: 'Open Source', research: 'Research', portfolio: 'Portfolio', hackathon: 'Hackathon',
};

export function ProjectsView({ phases }: { phases: PhaseInstance[] }) {
  const grouped = useMemo(() => {
    const rows = phases.flatMap(p => p.milestones.filter(m => m.projects.length > 0).flatMap(m => m.projects.map(pr => ({ ...pr, milestone: m }))));
    const byLevel = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = byLevel.get(r.level) ?? [];
      list.push(r);
      byLevel.set(r.level, list);
    }
    return byLevel;
  }, [phases]);

  if (grouped.size === 0) return <p className="text-body">No project ideas on this roadmap yet.</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {Array.from(grouped.entries()).map(([level, projects]) => (
        <div key={level}>
          <h3 className="font-serif" style={{ fontSize: '20px', marginBottom: '14px' }}>{LEVEL_LABELS[level as ProjectRef['level']] ?? level}</h3>
          <div className="roadmap-card-grid">
            {projects.map((p, idx) => (
              <div key={`${p.title}-${idx}`} className="card-editorial" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="roadmap-status-pill" style={{ alignSelf: 'flex-start', color: STATUS_COLORS[p.milestone.status], borderColor: STATUS_COLORS[p.milestone.status] }}>
                  {STATUS_LABELS[p.milestone.status]}
                </span>
                <h4 className="font-serif" style={{ fontSize: '17px', margin: 0 }}>{p.title.split('.')[0]}</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{p.description}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
