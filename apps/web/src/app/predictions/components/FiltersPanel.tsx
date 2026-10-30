'use client';

import React, { useEffect, useState } from 'react';
import { Filter, RotateCcw, ChevronDown, SlidersHorizontal, Search } from 'lucide-react';
import { collegesApi } from '../../../lib/colleges-api';
import { COLLEGE_TYPES, KCET_ENGINEERING_COURSES, COMEDK_COURSES, NEET_COURSES, type ExamCode } from '../constants';
import type { PredictorFilters } from '../types';

export type PredictionSortOption = 'nirf' | 'fee_asc' | 'placement_desc';

interface Props {
  examCode: ExamCode;
  filters: PredictorFilters;
  onChange: (filters: PredictorFilters) => void;
  sortBy: PredictionSortOption;
  onSortByChange: (sortBy: PredictionSortOption) => void;
}

export function FiltersPanel({ examCode, filters, onChange, sortBy, onSortByChange }: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [locationFacets, setLocationFacets] = useState<{ cities: string[]; districts: string[] }>({ cities: [], districts: [] });

  useEffect(() => {
    const controller = new AbortController();
    collegesApi.getFacets(examCode, controller.signal)
      .then(facets => setLocationFacets({ cities: facets.cities, districts: facets.districts }))
      .catch(() => {
        if (!controller.signal.aborted) setLocationFacets({ cities: [], districts: [] });
      });
    return () => controller.abort();
  }, [examCode]);

  const activeFilterCount = Object.values(filters).filter(
    val => val !== undefined && val !== '' && val !== false,
  ).length;

  const setFilter = <K extends keyof PredictorFilters>(key: K, value: PredictorFilters[K]) => {
    const updated = { ...filters, [key]: value };
    if (value === undefined || value === '') delete updated[key];
    if (Object.keys(updated).every((filterKey) => updated[filterKey as keyof PredictorFilters] === filters[filterKey as keyof PredictorFilters])) return;
    onChange(updated);
  };

  const handleReset = () => {
    onChange({});
    onSortByChange('nirf');
    setShowAdvanced(false);
  };

  const hasActiveFilters = activeFilterCount > 0 || sortBy !== 'nirf';
  const hasTooShortText = [filters.search, filters.city, filters.district]
    .some(value => Boolean(value?.trim()) && value!.trim().length < 2);

  // Merge unique course options for filter dropdown
  const allCourses = examCode === 'COMEDK' ? COMEDK_COURSES
    : examCode === 'NEET' ? NEET_COURSES
      : KCET_ENGINEERING_COURSES;

  return (
    <div
      className="card-editorial predictions-filter-bar"
      style={{
        padding: '14px 16px',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--card-bg, #ffffff)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        marginBottom: '20px',
      }}
    >
      {/* Primary Horizontal Controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginRight: '4px' }}>
            <Filter size={16} style={{ color: 'var(--accent-blue)' }} />
            <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
          </div>

          {/* Search Input */}
          <div style={{ position: 'relative', width: '180px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={filters.search ?? ''}
              onChange={e => setFilter('search', e.target.value || undefined)}
              className="input-editorial"
              placeholder="Search college/course..."
              style={{ paddingLeft: '30px', paddingRight: '10px', paddingTop: '8px', paddingBottom: '8px', fontSize: '13px', borderRadius: '8px', width: '100%' }}
              aria-label="Search colleges or courses"
            />
          </div>

          {/* Course Filter Dropdown */}
          <select
            value={filters.course ?? ''}
            onChange={e => setFilter('course', e.target.value || undefined)}
            className="input-editorial"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', minWidth: '150px' }}
            aria-label="Course Filter"
          >
            <option value="">All Courses</option>
            {allCourses.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* College Type Dropdown */}
          <select
            value={filters.collegeType ?? ''}
            onChange={e => setFilter('collegeType', e.target.value || undefined)}
            className="input-editorial"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', minWidth: '130px' }}
            aria-label="College Type Filter"
          >
            <option value="">All Types</option>
            {COLLEGE_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* City / Location Input */}
          <input
            type="text"
            value={filters.city ?? ''}
            onChange={e => setFilter('city', e.target.value || undefined)}
            className="input-editorial"
            placeholder="City (e.g. Bengaluru)"
            style={{ padding: '8px 12px', fontSize: '13px', borderRadius: '8px', width: '150px' }}
            aria-label="City Filter"
            list="prediction-city-options"
          />
          <datalist id="prediction-city-options">
            {locationFacets.cities.map(city => <option key={city} value={city} />)}
          </datalist>

          {/* Hostel Checkbox */}
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              userSelect: 'none',
              padding: '6px 10px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: filters.hostelRequired ? 'rgba(45, 110, 163, 0.08)' : 'transparent',
            }}
          >
            <input
              type="checkbox"
              checked={Boolean(filters.hostelRequired)}
              onChange={e => setFilter('hostelRequired', e.target.checked || undefined)}
            />
            <span>Hostel</span>
          </label>

          {/* More Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowAdvanced(prev => !prev)}
            aria-expanded={showAdvanced}
            aria-controls="prediction-advanced-filters"
            className="btn-editorial-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <SlidersHorizontal size={13} />
            <span>{showAdvanced ? 'Less' : 'More'}</span>
            <ChevronDown size={13} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>

        {/* Sort By & Reset Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: 500 }}>
              Sort By:
            </span>
            <select
              value={sortBy}
              onChange={e => onSortByChange(e.target.value as PredictionSortOption)}
              className="input-editorial"
              style={{
                padding: '8px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                fontWeight: 500,
                minWidth: '190px',
              }}
              aria-label="Sort Order"
            >
              <option value="nirf">{examCode === 'COMEDK' ? 'Historical rank fit (Default)' : 'NIRF Rank (Default)'}</option>
              <option value="fee_asc">Lowest Annual Fee</option>
              <option value="placement_desc">Highest Placement Average</option>
            </select>
          </div>

          {/* Reset Button */}
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasActiveFilters}
            className="btn-editorial-secondary"
            style={{
              padding: '8px 14px',
              fontSize: '13px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              opacity: hasActiveFilters ? 1 : 0.4,
              cursor: hasActiveFilters ? 'pointer' : 'not-allowed',
            }}
            title="Reset filters and sorting to defaults"
          >
            <RotateCcw size={13} />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {hasTooShortText && (
        <div role="status" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Type at least 2 characters to filter by college, course or location.
        </div>
      )}

      {/* Advanced Collapsible Filter Row */}
      {showAdvanced && (
        <div
          id="prediction-advanced-filters"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              District
            </label>
            <input
              type="text"
              value={filters.district ?? ''}
              onChange={e => setFilter('district', e.target.value || undefined)}
              className="input-editorial"
              placeholder="e.g. Urban"
              aria-label="District"
              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
              list="prediction-district-options"
            />
            <datalist id="prediction-district-options">
              {locationFacets.districts.map(district => <option key={district} value={district} />)}
            </datalist>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Max Annual Fee (₹)
            </label>
            <input
              type="number"
              value={filters.maxFee ?? ''}
              onChange={e => setFilter('maxFee', e.target.value ? Number(e.target.value) : undefined)}
              className="input-editorial"
              placeholder="e.g. 200000"
              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Max NIRF Rank
            </label>
            <input
              type="number"
              value={filters.maxNirfRank ?? ''}
              onChange={e => setFilter('maxNirfRank', e.target.value ? Number(e.target.value) : undefined)}
              className="input-editorial"
              placeholder="e.g. 100"
              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Min Placement Avg (LPA)
            </label>
            <input
              type="number"
              value={filters.minPlacementAverage ?? ''}
              onChange={e => setFilter('minPlacementAverage', e.target.value ? Number(e.target.value) : undefined)}
              className="input-editorial"
              placeholder="e.g. 8"
              style={{ padding: '6px 10px', fontSize: '12px', width: '100%' }}
            />
          </div>

        </div>
      )}
    </div>
  );
}
