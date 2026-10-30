'use client';

import type { PhaseInstance, MilestoneInstance, MilestoneStatus } from '../../../lib/roadmap-api';
import { CATEGORY_ICONS } from '../roadmap-helpers';

interface Props {
  phases: PhaseInstance[];
  onMilestoneUpdate: (milestoneKey: string, patch: { status?: MilestoneStatus }) => Promise<void>;
}

const COLUMNS: { key: MilestoneStatus; label: string; nextStatus?: MilestoneStatus; nextLabel?: string; prevStatus?: MilestoneStatus }[] = [
  { key: 'not_started', label: 'Not Started', nextStatus: 'in_progress', nextLabel: 'Start →' },
  { key: 'in_progress', label: 'In Progress', nextStatus: 'completed', nextLabel: 'Complete →', prevStatus: 'not_started' },
  { key: 'completed', label: 'Completed', prevStatus: 'not_started' },
];

function KanbanCard({ m, col, onMilestoneUpdate }: { m: MilestoneInstance; col: typeof COLUMNS[number]; onMilestoneUpdate: Props['onMilestoneUpdate'] }) {
  return (
    <div className="card-editorial roadmap-kanban-card">
      <span className="badge-editorial" style={{ fontSize: '11px' }}>{CATEGORY_ICONS[m.category]} {m.category.replace('_', ' ')}</span>
      <h4 className="font-serif" style={{ fontSize: '15px', margin: '8px 0 4px' }}>{m.title}</h4>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        {col.prevStatus && (
          <button type="button" className="roadmap-link-btn" onClick={() => onMilestoneUpdate(m.milestoneKey, { status: col.prevStatus })}>← Back</button>
        )}
        {col.nextStatus && (
          <button type="button" className="roadmap-link-btn" style={{ marginLeft: 'auto' }} onClick={() => onMilestoneUpdate(m.milestoneKey, { status: col.nextStatus })}>{col.nextLabel}</button>
        )}
      </div>
    </div>
  );
}

export function KanbanView({ phases, onMilestoneUpdate }: Props) {
  const all = phases.flatMap(p => p.milestones);
  const locked = all.filter(m => m.status === 'locked');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="roadmap-kanban-board">
        {COLUMNS.map(col => {
          const items = all.filter(m => m.status === col.key);
          return (
            <div key={col.key} className="roadmap-kanban-column">
              <div className="roadmap-kanban-column-header">{col.label} <span>{items.length}</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map(m => <KanbanCard key={m.milestoneKey} m={m} col={col} onMilestoneUpdate={onMilestoneUpdate} />)}
                {items.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nothing here yet.</p>}
              </div>
            </div>
          );
        })}
      </div>
      {locked.length > 0 && (
        <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{locked.length} milestone{locked.length === 1 ? '' : 's'} still locked behind prerequisites — complete earlier milestones to reveal them here.</p>
      )}
    </div>
  );
}
