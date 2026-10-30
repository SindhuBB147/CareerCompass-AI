'use client';

import { useMemo, useState } from 'react';
import { CAREER_CATEGORY_LABELS, type CareerCategory, type CareerSummary } from '../../../lib/roadmap-api';

interface Props {
  careers: CareerSummary[];
  onSelect: (careerId: string) => void;
  busy: boolean;
}

export function CareerPathSelector({ careers, onSelect, busy }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CareerCategory | 'all'>('all');

  const filtered = useMemo(() => careers.filter(c => {
    if (category !== 'all' && c.category !== category) return false;
    if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  }), [careers, category, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, CareerSummary[]>();
    for (const c of filtered) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>Choose Your Path</span>
        <h1 className="text-section-title font-serif">Personalized Career Roadmaps</h1>
        <p className="text-body" style={{ maxWidth: '720px' }}>
          Pick a career, and we&apos;ll build a personalized, milestone-by-milestone roadmap from your current profile — skills you already have, your semester, and your goals — to your first job or next step.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <input className="input-editorial" style={{ maxWidth: '320px' }} placeholder="Search careers..." value={query} onChange={e => setQuery(e.target.value)} />
        <select className="input-editorial" style={{ width: 'auto', padding: '14px 20px' }} value={category} onChange={e => setCategory(e.target.value as CareerCategory | 'all')}>
          <option value="all">All categories</option>
          {Object.entries(CAREER_CATEGORY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </div>

      {Array.from(grouped.entries()).map(([cat, list]) => (
        <div key={cat}>
          <h3 className="font-serif" style={{ fontSize: '20px', marginBottom: '16px' }}>{CAREER_CATEGORY_LABELS[cat as CareerCategory]}</h3>
          <div className="roadmap-career-grid">
            {list.map(c => (
              <button key={c.careerId} type="button" disabled={busy} className="card-editorial roadmap-career-card" onClick={() => onSelect(c.careerId)}>
                <h4 className="font-serif" style={{ fontSize: '18px', margin: '0 0 8px' }}>{c.name}</h4>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{c.description}</p>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.phaseCount} phases · {c.milestoneCount} milestones</span>
              </button>
            ))}
          </div>
        </div>
      ))}
      {filtered.length === 0 && <p className="text-body">No careers match your search.</p>}
    </div>
  );
}
