'use client';

import { useEffect, useState } from 'react';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { collegesApi, type College } from '../../../lib/colleges-api';
import type { AccommodationType, TransportPreference } from '../../../lib/financial-api';

export interface PlannerSelection {
  collegeId: string;
  collegeName: string;
  city: string;
  courseId: string;
  courseName: string;
  durationYears: number;
  hostelRequired: boolean;
  accommodationType: AccommodationType;
  transportPreference: TransportPreference;
  includeLaptop: boolean;
  familyContribution: number;
  currentSavings: number;
}

export const EMPTY_SELECTION: PlannerSelection = {
  collegeId: '', collegeName: '', city: '', courseId: '', courseName: '', durationYears: 4,
  hostelRequired: true, accommodationType: 'hostel', transportPreference: 'public', includeLaptop: false,
  familyContribution: 0, currentSavings: 0,
};

export function PlannerForm({
  selection,
  onChange,
}: {
  selection: PlannerSelection;
  onChange: (patch: Partial<PlannerSelection>) => void;
}) {
  const [query, setQuery] = useState(selection.collegeName);
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<College[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery === selection.collegeName) { setResults([]); return; }
    let cancelled = false;
    collegesApi.search({ q: debouncedQuery, limit: 6 })
      .then(res => { if (!cancelled) setResults(res.results); })
      .catch(() => { if (!cancelled) setResults([]); });
    return () => { cancelled = true; };
  }, [debouncedQuery, selection.collegeName]);

  const pickCollege = (college: College) => {
    setSelectedCollege(college);
    setQuery(college.name);
    setShowResults(false);
    const firstCourse = college.courses[0];
    onChange({
      collegeId: college.id || college._id,
      collegeName: college.name,
      city: college.city,
      courseId: firstCourse?.courseId ?? '',
      courseName: firstCourse?.name ?? '',
      durationYears: firstCourse?.durationYears ?? 4,
    });
  };

  const pickCourse = (courseId: string) => {
    const course = selectedCollege?.courses.find(c => c.courseId === courseId);
    if (!course) return;
    onChange({ courseId: course.courseId, courseName: course.name, durationYears: course.durationYears });
  };

  return (
    <div className="card-editorial" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h3 className="font-serif" style={{ fontSize: '22px', margin: 0 }}>Your College &amp; Course</h3>

      <div style={{ position: 'relative' }}>
        <label className="colleges-filter-label" style={{ display: 'block', marginBottom: '6px' }}>College</label>
        <input
          className="input-editorial"
          placeholder="Search by college name…"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
        />
        {showResults && results.length > 0 && (
          <div className="card-editorial" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10, marginTop: '4px', padding: '8px', maxHeight: '260px', overflowY: 'auto' }}>
            {results.map(c => (
              <button
                key={c.id || c._id} type="button"
                onClick={() => pickCollege(c)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '8px', fontSize: '14px' }}
              >
                <strong>{c.name}</strong> <span style={{ color: 'var(--text-muted)' }}>— {c.city}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCollege && (
        <div>
          <label className="colleges-filter-label" style={{ display: 'block', marginBottom: '6px' }}>Course</label>
          <select className="input-editorial" value={selection.courseId} onChange={e => pickCourse(e.target.value)}>
            {selectedCollege.courses.map(c => (
              <option key={c.courseId} value={c.courseId}>{c.name} ({c.durationYears} yrs)</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="colleges-filter-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" checked={selection.hostelRequired} onChange={e => onChange({ hostelRequired: e.target.checked })} />
          I will need hostel accommodation
        </label>
      </div>

      {!selection.hostelRequired && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label className="colleges-filter-label" style={{ display: 'block', marginBottom: '6px' }}>Accommodation Type</label>
            <select className="input-editorial" value={selection.accommodationType} onChange={e => onChange({ accommodationType: e.target.value as AccommodationType })}>
              <option value="pg">PG</option>
              <option value="apartment_shared">Shared Apartment</option>
              <option value="day_scholar">Day Scholar (living at home)</option>
            </select>
          </div>
          <div>
            <label className="colleges-filter-label" style={{ display: 'block', marginBottom: '6px' }}>Transport</label>
            <select className="input-editorial" value={selection.transportPreference} onChange={e => onChange({ transportPreference: e.target.value as TransportPreference })}>
              <option value="public">Public Transport</option>
              <option value="two_wheeler">Two-Wheeler</option>
              <option value="none">None / Walking Distance</option>
            </select>
          </div>
        </div>
      )}

      <label className="colleges-filter-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input type="checkbox" checked={selection.includeLaptop} onChange={e => onChange({ includeLaptop: e.target.checked })} />
        Include a recommended laptop purchase
      </label>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <label className="colleges-filter-label" style={{ display: 'block', marginBottom: '6px' }}>Expected Family Contribution (₹)</label>
          <input
            type="number" min={0} step={10000} className="input-editorial"
            value={selection.familyContribution}
            onChange={e => onChange({ familyContribution: Math.max(0, Number(e.target.value)) })}
          />
        </div>
        <div>
          <label className="colleges-filter-label" style={{ display: 'block', marginBottom: '6px' }}>Current Savings (₹)</label>
          <input
            type="number" min={0} step={10000} className="input-editorial"
            value={selection.currentSavings}
            onChange={e => onChange({ currentSavings: Math.max(0, Number(e.target.value)) })}
          />
        </div>
      </div>
    </div>
  );
}
