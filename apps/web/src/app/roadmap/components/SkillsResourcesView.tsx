'use client';

import { useMemo } from 'react';
import type { PhaseInstance } from '../../../lib/roadmap-api';

export function SkillsResourcesView({ phases }: { phases: PhaseInstance[] }) {
  const milestones = phases.flatMap(p => p.milestones);

  const skillGroups = useMemo(() => {
    const known: string[] = [];
    const inProgress: string[] = [];
    const upcoming: string[] = [];
    for (const m of milestones) {
      for (const s of m.skills) {
        if (m.status === 'completed') known.push(s);
        else if (m.status === 'in_progress') inProgress.push(s);
        else if (m.status !== 'locked') upcoming.push(s);
      }
    }
    return {
      known: Array.from(new Set(known)),
      inProgress: Array.from(new Set(inProgress)),
      upcoming: Array.from(new Set(upcoming)),
    };
  }, [milestones]);

  const resources = useMemo(() => {
    const seen = new Set<string>();
    return milestones.flatMap(m => m.resources.map(r => ({ ...r, forMilestone: m.title })))
      .filter(r => { if (seen.has(r.title)) return false; seen.add(r.title); return true; });
  }, [milestones]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '12px' }}>Skills You've Built</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {skillGroups.known.length === 0 && <p className="text-body">None yet — complete a skill milestone to see it here.</p>}
          {skillGroups.known.map(s => <span key={s} className="roadmap-chip" data-tone="done">{s}</span>)}
        </div>
      </div>
      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '12px' }}>Currently Learning</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {skillGroups.inProgress.length === 0 && <p className="text-body">Nothing in progress right now.</p>}
          {skillGroups.inProgress.map(s => <span key={s} className="roadmap-chip" data-tone="progress">{s}</span>)}
        </div>
      </div>
      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '12px' }}>Coming Up</h3>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {skillGroups.upcoming.map(s => <span key={s} className="roadmap-chip">{s}</span>)}
        </div>
      </div>
      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '12px' }}>Curated Resources</h3>
        <div className="card-editorial" style={{ padding: 0 }}>
          {resources.map((r, idx) => (
            <div key={r.title} className="roadmap-checklist-row" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                {r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)', fontWeight: 500 }}>{r.title}</a> : <strong>{r.title}</strong>}
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.provider} · for &ldquo;{r.forMilestone}&rdquo;</div>
              </div>
              <span className="badge-editorial" style={{ fontSize: '11px' }}>{r.type.replace('_', ' ')}</span>
            </div>
          ))}
          {resources.length === 0 && <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No resources on this roadmap yet.</p>}
        </div>
      </div>
    </div>
  );
}
