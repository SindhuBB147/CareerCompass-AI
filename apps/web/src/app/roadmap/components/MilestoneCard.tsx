'use client';

import { useState } from 'react';
import type { MilestoneInstance, MilestoneStatus } from '../../../lib/roadmap-api';
import {
  CATEGORY_ICONS, CATEGORY_LABELS, DIFFICULTY_LABELS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS,
} from '../roadmap-helpers';

interface Props {
  milestone: MilestoneInstance;
  onUpdate: (milestoneKey: string, patch: { status?: MilestoneStatus; notes?: string }) => Promise<void>;
  compact?: boolean;
}

export function MilestoneCard({ milestone: m, onUpdate, compact }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notesDraft, setNotesDraft] = useState(m.notes);
  const hasDetails = m.skills.length > 0 || m.resources.length > 0 || m.certifications.length > 0 || m.projects.length > 0;

  const doUpdate = async (patch: { status?: MilestoneStatus; notes?: string }) => {
    setBusy(true);
    try { await onUpdate(m.milestoneKey, patch); } finally { setBusy(false); }
  };

  return (
    <div
      className="card-editorial roadmap-milestone-card"
      data-status={m.status}
      style={{ padding: compact ? '18px' : '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="badge-editorial">{CATEGORY_ICONS[m.category]} {CATEGORY_LABELS[m.category]}</span>
            <span className="badge-editorial" style={{ background: 'transparent', border: '1px solid var(--border-color)' }}>{DIFFICULTY_LABELS[m.difficulty]}</span>
            {m.priority === 'high' && <span className="badge-editorial" style={{ background: 'rgba(45,110,163,0.12)', color: 'var(--accent-blue)' }}>{PRIORITY_LABELS[m.priority]}</span>}
          </div>
          <h4 className="font-serif" style={{ fontSize: compact ? '17px' : '20px', margin: 0 }}>{m.title}</h4>
          {!compact && <p className="text-body" style={{ fontSize: '15px', margin: 0 }}>{m.description}</p>}
        </div>
        <span
          className="roadmap-status-pill"
          style={{ color: STATUS_COLORS[m.status], borderColor: STATUS_COLORS[m.status] }}
        >
          {STATUS_LABELS[m.status]}
        </span>
      </div>

      {m.autoCompletedFromProfile && (
        <div style={{ fontSize: '13px', color: 'var(--accent-blue)' }}>✓ {m.notes || 'Auto-detected from your profile.'}</div>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        {m.status === 'locked' && <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Complete its prerequisites to unlock this milestone.</span>}
        {m.status === 'not_started' && (
          <button type="button" className="btn-editorial-secondary roadmap-btn-sm" disabled={busy} onClick={() => doUpdate({ status: 'in_progress' })}>Start</button>
        )}
        {m.status === 'in_progress' && (
          <>
            <button type="button" className="btn-editorial-primary roadmap-btn-sm" disabled={busy} onClick={() => doUpdate({ status: 'completed' })}>Mark Complete</button>
            <button type="button" className="btn-editorial-secondary roadmap-btn-sm" disabled={busy} onClick={() => doUpdate({ status: 'not_started' })}>Reset</button>
          </>
        )}
        {m.status === 'completed' && (
          <button type="button" className="btn-editorial-secondary roadmap-btn-sm" disabled={busy} onClick={() => doUpdate({ status: 'not_started' })}>Reopen</button>
        )}
        {hasDetails && (
          <button type="button" className="roadmap-link-btn" onClick={() => setExpanded(e => !e)}>
            {expanded ? 'Hide details' : `Show details (${m.skills.length + m.resources.length + m.certifications.length + m.projects.length})`}
          </button>
        )}
        <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: 'auto' }}>~{m.estimatedWeeks}w</span>
      </div>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
          {m.skills.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {m.skills.map(s => <span key={s} className="roadmap-chip">{s}</span>)}
            </div>
          )}
          {m.resources.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {m.resources.map(r => (
                <li key={r.title}>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-blue)' }}>{r.title}</a> : r.title} <span style={{ color: 'var(--text-muted)' }}>({r.provider})</span></li>
              ))}
            </ul>
          )}
          {m.certifications.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {m.certifications.map(c => <li key={c.name}>{c.name} — {c.provider}</li>)}
            </ul>
          )}
          {m.projects.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              {m.projects.map(p => <li key={p.title}><strong>{p.title.split('.')[0]}</strong>: {p.description}</li>)}
            </ul>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              className="input-editorial"
              placeholder="Add a personal note..."
              value={notesDraft}
              onChange={e => setNotesDraft(e.target.value)}
              onBlur={() => { if (notesDraft !== m.notes) doUpdate({ notes: notesDraft }); }}
              style={{ minHeight: '60px', fontSize: '14px' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
