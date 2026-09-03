'use client';

import React from 'react';
import type { CollegeFacets, ExamCode, SearchCollegesParams } from '../../lib/colleges-api';

export interface CollegeFilterState {
  branch: string;
  discipline: string;
  city: string;
  district: string;
  collegeTypes: string[];
  hostelAvailable: boolean;
  maxFee: number;
  maxNirf: number;
  naac: string;
  nbaOnly: boolean;
  aicteApproved: boolean;
}

export const DEFAULT_FILTERS: CollegeFilterState = {
  branch: '', discipline: '', city: '', district: '',
  collegeTypes: [], hostelAvailable: false,
  maxFee: 600000, maxNirf: 500, naac: '',
  nbaOnly: false, aicteApproved: false,
};

const ALL_COLLEGE_TYPES = ['Government', 'Private', 'Autonomous', 'Deemed'];

// Labels differ per exam so the panel reads naturally for each aspirant
// audience — e.g. NEET aspirants think in terms of "Medical College Type",
// not "Engineering Branch" — while the underlying filter (course/discipline
// facets scoped to the exam) is the same real data for all three.
const EXAM_COPY: Record<ExamCode, { courseLabel: string; disciplineLabel: string; disciplineOptions?: string[] }> = {
  KCET: { courseLabel: 'Course / Branch', disciplineLabel: 'Discipline' },
  COMEDK: { courseLabel: 'Course / Branch', disciplineLabel: 'Discipline' },
  NEET: {
    courseLabel: 'Course',
    disciplineLabel: 'Medical College Type',
    disciplineOptions: ['Medical', 'Dental', 'Ayurveda', 'Unani', 'Homeopathy', 'Naturopathy', 'Nursing', 'Pharmacy', 'Veterinary', 'AlliedHealth'],
  },
};

export function filtersToParams(filters: CollegeFilterState): Partial<SearchCollegesParams> {
  return {
    branch: filters.branch || undefined,
    discipline: filters.discipline || undefined,
    city: filters.city || undefined,
    district: filters.district || undefined,
    collegeType: filters.collegeTypes.length ? filters.collegeTypes.join(',') : undefined,
    hostelAvailable: filters.hostelAvailable || undefined,
    maxFee: filters.maxFee < DEFAULT_FILTERS.maxFee ? filters.maxFee : undefined,
    maxNirf: filters.maxNirf < DEFAULT_FILTERS.maxNirf ? filters.maxNirf : undefined,
    naac: filters.naac || undefined,
    nbaOnly: filters.nbaOnly || undefined,
    aicteApproved: filters.aicteApproved || undefined,
  };
}

interface FilterPanelProps {
  examCode: ExamCode;
  filters: CollegeFilterState;
  onChange: (filters: CollegeFilterState) => void;
  facets: CollegeFacets | null;
  resultCount: number;
  totalCount: number;
}

export function FilterPanel({ examCode, filters, onChange, facets, resultCount, totalCount }: FilterPanelProps) {
  const copy = EXAM_COPY[examCode];
  const set = <K extends keyof CollegeFilterState>(key: K, value: CollegeFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const toggleCollegeType = (type: string) => {
    const has = filters.collegeTypes.includes(type);
    set('collegeTypes', has ? filters.collegeTypes.filter((t) => t !== type) : [...filters.collegeTypes, type]);
  };

  const collegeTypeOptions = facets?.collegeTypes?.length ? facets.collegeTypes : ALL_COLLEGE_TYPES;
  const disciplineOptions = copy.disciplineOptions ?? facets?.disciplines ?? [];

  return (
    <aside className="card-editorial colleges-filter-panel" aria-label="College filters">
      <div className="colleges-filter-header">
        <h3 className="colleges-filter-title">Filters</h3>
        <button type="button" onClick={() => onChange(DEFAULT_FILTERS)} className="colleges-filter-reset">
          Reset
        </button>
      </div>

      <div className="colleges-filter-group">
        <label htmlFor="filter-branch" className="colleges-filter-label">{copy.courseLabel}</label>
        <select
          id="filter-branch"
          value={filters.branch}
          onChange={(e) => set('branch', e.target.value)}
          className="input-editorial colleges-filter-input"
        >
          <option value="">All Courses</option>
          {(facets?.branches ?? []).map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>

      {disciplineOptions.length > 0 && (
        <div className="colleges-filter-group">
          <label htmlFor="filter-discipline" className="colleges-filter-label">{copy.disciplineLabel}</label>
          <select
            id="filter-discipline"
            value={filters.discipline}
            onChange={(e) => set('discipline', e.target.value)}
            className="input-editorial colleges-filter-input"
          >
            <option value="">All</option>
            {disciplineOptions.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      <div className="colleges-filter-group">
        <label className="colleges-filter-label">College Type</label>
        <div className="colleges-filter-checkbox-list">
          {collegeTypeOptions.map((type) => (
            <label key={type} className="colleges-filter-checkbox">
              <input
                type="checkbox"
                checked={filters.collegeTypes.includes(type)}
                onChange={() => toggleCollegeType(type)}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      <div className="colleges-filter-group-row">
        <div className="colleges-filter-group">
          <label htmlFor="filter-district" className="colleges-filter-label">District</label>
          <select
            id="filter-district"
            value={filters.district}
            onChange={(e) => set('district', e.target.value)}
            className="input-editorial colleges-filter-input"
          >
            <option value="">All</option>
            {(facets?.districts ?? []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <div className="colleges-filter-group">
          <label htmlFor="filter-city" className="colleges-filter-label">City</label>
          <select
            id="filter-city"
            value={filters.city}
            onChange={(e) => set('city', e.target.value)}
            className="input-editorial colleges-filter-input"
          >
            <option value="">All</option>
            {(facets?.cities ?? []).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="colleges-filter-group">
        <div className="colleges-filter-range-label">
          <span>Max Annual Fee</span>
          <span className="colleges-filter-range-value">₹{(filters.maxFee / 100000).toFixed(1)} L/yr</span>
        </div>
        <input
          type="range" min={50000} max={600000} step={25000}
          value={filters.maxFee}
          onChange={(e) => set('maxFee', Number(e.target.value))}
          className="colleges-filter-range"
          aria-label="Maximum annual fee"
        />
      </div>

      <div className="colleges-filter-group">
        <div className="colleges-filter-range-label">
          <span>NIRF Rank</span>
          <span className="colleges-filter-range-value">{filters.maxNirf >= 500 ? 'Any' : `Top #${filters.maxNirf}`}</span>
        </div>
        <input
          type="range" min={10} max={500} step={10}
          value={filters.maxNirf}
          onChange={(e) => set('maxNirf', Number(e.target.value))}
          className="colleges-filter-range"
          aria-label="Maximum NIRF rank"
        />
      </div>

      <div className="colleges-filter-group">
        <label htmlFor="filter-naac" className="colleges-filter-label">NAAC Grade</label>
        <select
          id="filter-naac"
          value={filters.naac}
          onChange={(e) => set('naac', e.target.value)}
          className="input-editorial colleges-filter-input"
        >
          <option value="">Any Grade</option>
          {(facets?.naacGrades ?? []).map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="colleges-filter-group colleges-filter-checkbox-list">
        <label className="colleges-filter-checkbox">
          <input type="checkbox" checked={filters.hostelAvailable} onChange={(e) => set('hostelAvailable', e.target.checked)} />
          Hostel Available
        </label>
        <label className="colleges-filter-checkbox">
          <input type="checkbox" checked={filters.nbaOnly} onChange={(e) => set('nbaOnly', e.target.checked)} />
          NBA Accredited
        </label>
        <label className="colleges-filter-checkbox">
          <input type="checkbox" checked={filters.aicteApproved} onChange={(e) => set('aicteApproved', e.target.checked)} />
          AICTE Approved
        </label>
      </div>

      <div className="colleges-filter-summary">
        Showing {resultCount} of {totalCount} Colleges
      </div>
    </aside>
  );
}
