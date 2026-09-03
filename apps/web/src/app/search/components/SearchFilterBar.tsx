'use client';

import type { SearchFilters } from '../../../lib/search-api';

const COLLEGE_TYPES = ['Government', 'Private', 'Autonomous', 'Deemed'];

interface Props {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
}

/**
 * Deliberately minimal compared to the College Explorer's FilterPanel —
 * Smart Search's entity extraction already covers most of what that panel
 * does from natural language (discipline, city, budget, hostel, NIRF), so
 * this only exposes the filters worth refining *after* seeing AI-ranked
 * results: college type, hostel, and the two numeric ranges.
 */
export function SearchFilterBar({ filters, onChange }: Props) {
  const set = <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleType = (type: string) => {
    const current = filters.collegeType?.split(',').filter(Boolean) ?? [];
    const next = current.includes(type) ? current.filter((t) => t !== type) : [...current, type];
    set('collegeType', next.length ? next.join(',') : undefined);
  };

  const activeTypes = filters.collegeType?.split(',').filter(Boolean) ?? [];

  return (
    <div className="card-editorial smart-search-filter-bar" aria-label="Refine results">
      <div className="smart-search-filter-chips">
        {COLLEGE_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            className="colleges-search-chip"
            data-active={activeTypes.includes(type)}
            onClick={() => toggleType(type)}
          >
            {type}
          </button>
        ))}
        <button
          type="button"
          className="colleges-search-chip"
          data-active={filters.hostelAvailable ?? false}
          onClick={() => set('hostelAvailable', filters.hostelAvailable ? undefined : true)}
        >
          Hostel Available
        </button>
      </div>

      <div className="smart-search-filter-ranges">
        <label className="smart-search-filter-range">
          <span>Max Annual Fee: {filters.maxFee ? `₹${(filters.maxFee / 100000).toFixed(1)} L` : 'Any'}</span>
          <input
            type="range" min={50000} max={600000} step={25000}
            value={filters.maxFee ?? 600000}
            onChange={(e) => set('maxFee', Number(e.target.value) >= 600000 ? undefined : Number(e.target.value))}
          />
        </label>
        <label className="smart-search-filter-range">
          <span>Max NIRF Rank: {filters.maxNirf ? `#${filters.maxNirf}` : 'Any'}</span>
          <input
            type="range" min={10} max={500} step={10}
            value={filters.maxNirf ?? 500}
            onChange={(e) => set('maxNirf', Number(e.target.value) >= 500 ? undefined : Number(e.target.value))}
          />
        </label>
      </div>

      {(activeTypes.length > 0 || filters.hostelAvailable || filters.maxFee || filters.maxNirf) && (
        <button type="button" className="smart-search-filter-reset" onClick={() => onChange({})}>Reset filters</button>
      )}
    </div>
  );
}
