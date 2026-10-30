'use client';
import { useEffect, useState } from 'react';
import { MultiSelectChips } from './MultiSelectChips';
import {
  EXAM_OPTIONS, ExamCode, KCET_DISCIPLINES, KCET_ENGINEERING_COURSES, KCET_CATEGORIES,
  KCET_HORIZONTAL_RESERVATIONS, COMEDK_COURSES, NEET_COURSES, NEET_CATEGORIES,
  NEET_SPECIAL_RESERVATIONS,
} from '../constants';
import type { PredictCollegesRequest } from '../types';

interface Props {
  onSubmit: (request: PredictCollegesRequest) => void;
  loading: boolean;
}

export function PredictorForm({ onSubmit, loading }: Props) {
  const [examCode, setExamCode] = useState<ExamCode>('KCET');
  const [rank, setRank] = useState<number | ''>('');
  const [category, setCategory] = useState('');
  const [discipline, setDiscipline] = useState('Engineering');
  const [courseSelections, setCourseSelections] = useState<string[]>([]);
  const [horizontalReservations, setHorizontalReservations] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset exam-specific fields when the exam changes, so stale selections
  // from one exam's taxonomy never leak into another's request.
  useEffect(() => {
    setCategory('');
    setDiscipline('Engineering');
    setCourseSelections([]);
    setHorizontalReservations([]);
    setFormError(null);
  }, [examCode]);

  // Preferred Courses only applies to KCET when discipline === Engineering.
  const showKcetCourses = examCode === 'KCET' && discipline === 'Engineering';
  const courseOptions = examCode === 'KCET' ? KCET_ENGINEERING_COURSES : examCode === 'COMEDK' ? COMEDK_COURSES : NEET_COURSES;
  const categoryOptions = examCode === 'KCET' ? KCET_CATEGORIES : examCode === 'NEET' ? NEET_CATEGORIES : null;
  const reservationOptions = examCode === 'KCET' ? KCET_HORIZONTAL_RESERVATIONS : examCode === 'NEET' ? NEET_SPECIAL_RESERVATIONS : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!rank || rank < 1) { setFormError('Enter a valid rank.'); return; }
    if (categoryOptions && !category) { setFormError('Select your reservation category.'); return; }
    if (examCode === 'KCET' && !discipline) { setFormError('Select a discipline.'); return; }
    if (examCode === 'KCET' && discipline === 'Engineering' && courseSelections.length === 0) {
      setFormError('Select at least one preferred course.'); return;
    }
    if (examCode !== 'KCET' && courseSelections.length === 0) {
      setFormError('Select at least one preferred course.'); return;
    }

    onSubmit({
      examCode,
      rank: Number(rank),
      category: categoryOptions ? category : undefined,
      discipline: examCode === 'KCET' ? discipline : undefined,
      courseSelections: (examCode === 'KCET' && discipline !== 'Engineering') ? undefined : courseSelections,
      horizontalReservations: horizontalReservations.length > 0 ? horizontalReservations : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card-editorial" style={{ padding: '36px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <h3 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>Enter Your Details</h3>

      <div>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
          Select Entrance Exam
        </label>
        <select value={examCode} onChange={e => setExamCode(e.target.value as ExamCode)} className="input-editorial">
          {EXAM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {examCode === 'KCET' && (
        <div>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
            Discipline
          </label>
          <select value={discipline} onChange={e => setDiscipline(e.target.value)} className="input-editorial">
            {KCET_DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      )}

      {(showKcetCourses || examCode !== 'KCET') && (
        <div>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
            Preferred Courses <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(select one or more)</span>
          </label>
          <MultiSelectChips options={courseOptions} selected={courseSelections} onChange={setCourseSelections} maxHeight="220px" />
        </div>
      )}

      <div>
        <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
          {examCode === 'NEET' ? 'State Rank' : 'Rank'}
        </label>
        <input
          type="number"
          min={1}
          value={rank}
          onChange={e => setRank(e.target.value ? Number(e.target.value) : '')}
          className="input-editorial"
          placeholder="e.g. 4500"
        />
      </div>

      {categoryOptions && (
        <div>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
            Category
          </label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="input-editorial">
            <option value="">Select category</option>
            {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}

      {reservationOptions && (
        <div>
          <label style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>
            {examCode === 'KCET' ? 'Additional / Horizontal Reservation' : 'Special Reservation'} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <MultiSelectChips options={reservationOptions} selected={horizontalReservations} onChange={setHorizontalReservations} maxHeight="140px" />
        </div>
      )}

      {formError && <div style={{ color: '#B3261E', fontSize: '14px' }}>{formError}</div>}

      <button type="submit" className="btn-editorial-primary" style={{ width: '100%', marginTop: '8px' }} disabled={loading}>
        {loading ? 'Calculating…' : 'Calculate Admission Probability →'}
      </button>
    </form>
  );
}
