'use client';

import { useMemo, useState } from 'react';
import type { PhaseInstance, MilestoneCategory, MilestoneStatus } from '../../../lib/roadmap-api';
import { CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from '../roadmap-helpers';

interface Props {
  phases: PhaseInstance[];
  onMilestoneUpdate: (milestoneKey: string, patch: { status?: MilestoneStatus }) => Promise<void>;
}

export function ChecklistView({ phases, onMilestoneUpdate }: Props) {
  const [categoryFilter, setCategoryFilter] = useState<MilestoneCategory | 'all'>('all');
  const [hideCompleted, setHideCompleted] = useState(false);

  const rows = useMemo(() => {
    return phases.flatMap(phase => phase.milestones.map(m => ({ ...m, phaseLabel: phase.label })))
      .filter(m => categoryFilter === 'all' || m.category === categoryFilter)
      .filter(m => !hideCompleted || m.status !== 'completed');
  }, [phases, categoryFilter, hideCompleted]);

  const categories = useMemo(() => Array.from(new Set(phases.flatMap(p => p.milestones.map(m => m.category)))), [phases]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input-editorial" style={{ width: 'auto', padding: '10px 16px' }} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value as MilestoneCategory | 'all')}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
        </select>
        <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={hideCompleted} onChange={e => setHideCompleted(e.target.checked)} /> Hide completed
        </label>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>{rows.length} milestone{rows.length === 1 ? '' : 's'}</span>
      </div>

      <div className="card-editorial" style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((m, idx) => (
          <div key={m.milestoneKey} className="roadmap-checklist-row" style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--border-color)' }}>
            <input
              type="checkbox"
              checked={m.status === 'completed'}
              disabled={m.status === 'locked'}
              onChange={e => onMilestoneUpdate(m.milestoneKey, { status: e.target.checked ? 'completed' : 'not_started' })}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, textDecoration: m.status === 'completed' ? 'line-through' : 'none', color: m.status === 'completed' ? 'var(--text-muted)' : 'var(--text-primary)' }}>{m.title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.phaseLabel} · {CATEGORY_LABELS[m.category]}</div>
            </div>
            <span className="roadmap-status-pill" style={{ color: STATUS_COLORS[m.status], borderColor: STATUS_COLORS[m.status] }}>{STATUS_LABELS[m.status]}</span>
          </div>
        ))}
        {rows.length === 0 && <p style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No milestones match this filter.</p>}
      </div>
    </div>
  );
}
