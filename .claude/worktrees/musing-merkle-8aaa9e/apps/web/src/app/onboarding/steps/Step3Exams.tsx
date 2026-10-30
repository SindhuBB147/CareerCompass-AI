'use client';

import { Fragment } from 'react';
import { EXAM_LABELS, EXAM_OPTIONS, type ExamEntry, type Step3Data } from '../types';

const emptyEntry = (examCode: string): ExamEntry => ({
  examCode, rank: '', categoryRank: '', percentile: '', attemptYear: String(new Date().getFullYear()),
});

export function Step3Exams({ data, onChange }: { data: Step3Data; onChange: (patch: Partial<Step3Data>) => void }) {
  const selectedCodes = new Set(data.exams.map(e => e.examCode));

  const toggleExam = (code: string) => {
    if (selectedCodes.has(code)) {
      onChange({ exams: data.exams.filter(e => e.examCode !== code) });
    } else {
      onChange({ exams: [...data.exams, emptyEntry(code)] });
    }
  };

  const updateEntry = (code: string, patch: Partial<ExamEntry>) => {
    onChange({ exams: data.exams.map(e => (e.examCode === code ? { ...e, ...patch } : e)) });
  };

  const usesPercentile = (code: string) => code === 'JEE_MAIN' || code === 'NEET';

  return (
    <Fragment>
      <div className="wizard-step-heading">
        <h2 className="font-serif">Entrance Examination</h2>
        <p>Select every entrance exam you've taken or plan to take, then add your scores.</p>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Exams</label>
        <div className="wizard-chip-group">
          {EXAM_OPTIONS.map(code => (
            <button
              key={code} type="button" className="wizard-chip" data-selected={selectedCodes.has(code)}
              onClick={() => toggleExam(code)}
            >
              {EXAM_LABELS[code]}
            </button>
          ))}
        </div>
      </div>

      {data.exams.length === 0 && <p className="wizard-hint">Select at least one exam above to add your scores.</p>}

      {data.exams.map(entry => (
        <div key={entry.examCode} className="wizard-exam-card">
          <div className="wizard-exam-card-header">
            <strong>{EXAM_LABELS[entry.examCode]}</strong>
            <button type="button" className="wizard-exam-remove" onClick={() => toggleExam(entry.examCode)}>Remove</button>
          </div>
          <div className="wizard-grid-3">
            <div className="wizard-field">
              <label className="wizard-label">Rank</label>
              <input type="number" min={1} className="input-editorial" value={entry.rank} onChange={e => updateEntry(entry.examCode, { rank: e.target.value })} />
            </div>
            <div className="wizard-field">
              <label className="wizard-label">Category Rank</label>
              <input type="number" min={1} className="input-editorial" value={entry.categoryRank} onChange={e => updateEntry(entry.examCode, { categoryRank: e.target.value })} />
            </div>
            {usesPercentile(entry.examCode) ? (
              <div className="wizard-field">
                <label className="wizard-label">Percentile</label>
                <input type="number" min={0} max={100} step={0.01} className="input-editorial" value={entry.percentile} onChange={e => updateEntry(entry.examCode, { percentile: e.target.value })} />
              </div>
            ) : (
              <div className="wizard-field">
                <label className="wizard-label">Attempt Year</label>
                <input type="number" className="input-editorial" value={entry.attemptYear} onChange={e => updateEntry(entry.examCode, { attemptYear: e.target.value })} />
              </div>
            )}
          </div>
          {usesPercentile(entry.examCode) && (
            <div className="wizard-field">
              <label className="wizard-label">Attempt Year</label>
              <input type="number" className="input-editorial" value={entry.attemptYear} onChange={e => updateEntry(entry.examCode, { attemptYear: e.target.value })} />
            </div>
          )}
        </div>
      ))}
    </Fragment>
  );
}
