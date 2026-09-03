'use client';
import { useState } from 'react';
import { COLLEGE_TYPES } from '../constants';
import type { PredictorFilters } from '../types';

interface Props {
  filters: PredictorFilters;
  onChange: (filters: PredictorFilters) => void;
  sortBy: 'nirf' | 'probability';
  onSortByChange: (sortBy: 'nirf' | 'probability') => void;
}

export function FiltersPanel({ filters, onChange, sortBy, onSortByChange }: Props) {
  const [local, setLocal] = useState<PredictorFilters>(filters);

  const apply = () => onChange(local);
  const clear = () => { setLocal({}); onChange({}); };

  const set = <K extends keyof PredictorFilters>(key: K, value: PredictorFilters[K]) =>
    setLocal(prev => ({ ...prev, [key]: value }));

  return (
    <div className="card-editorial" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>Filters</h4>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>Sort By</label>
        <select value={sortBy} onChange={e => onSortByChange(e.target.value as 'nirf' | 'probability')} className="input-editorial">
          <option value="nirf">NIRF Ranking</option>
          <option value="probability">Recommendation Fit Score</option>
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>College Type</label>
        <select value={local.collegeType ?? ''} onChange={e => set('collegeType', e.target.value || undefined)} className="input-editorial">
          <option value="">All Types</option>
          {COLLEGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>City</label>
        <input type="text" value={local.city ?? ''} onChange={e => set('city', e.target.value || undefined)} className="input-editorial" placeholder="e.g. Bengaluru" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>District</label>
        <input type="text" value={local.district ?? ''} onChange={e => set('district', e.target.value || undefined)} className="input-editorial" placeholder="e.g. Bengaluru Urban" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>Min Fee</label>
          <input type="number" value={local.minFee ?? ''} onChange={e => set('minFee', e.target.value ? Number(e.target.value) : undefined)} className="input-editorial" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>Max Fee</label>
          <input type="number" value={local.maxFee ?? ''} onChange={e => set('maxFee', e.target.value ? Number(e.target.value) : undefined)} className="input-editorial" />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>Max NIRF Rank</label>
        <input type="number" value={local.maxNirfRank ?? ''} onChange={e => set('maxNirfRank', e.target.value ? Number(e.target.value) : undefined)} className="input-editorial" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>Min Placement Avg (LPA)</label>
        <input type="number" value={local.minPlacementAverage ?? ''} onChange={e => set('minPlacementAverage', e.target.value ? Number(e.target.value) : undefined)} className="input-editorial" />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: 'var(--text-muted)' }}>Min Recommendation Fit Score</label>
        <input type="number" min={0} max={100} value={local.minProbabilityPercent ?? ''} onChange={e => set('minProbabilityPercent', e.target.value ? Number(e.target.value) : undefined)} className="input-editorial" />
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
        <input type="checkbox" checked={Boolean(local.hostelRequired)} onChange={e => set('hostelRequired', e.target.checked || undefined)} />
        Hostel Required
      </label>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={apply} className="btn-editorial-primary" style={{ flex: 1, padding: '10px', fontSize: '13px' }}>Apply</button>
        <button type="button" onClick={clear} className="btn-editorial-secondary" style={{ padding: '10px 16px', fontSize: '13px' }}>Clear</button>
      </div>
    </div>
  );
}
