'use client';

import React from 'react';
import type { ExamCode } from '../../lib/colleges-api';

const EXAMS: { code: ExamCode; label: string; description: string }[] = [
  { code: 'KCET', label: 'KCET', description: 'Karnataka CET — Engineering, Medical & more' },
  { code: 'COMEDK', label: 'COMEDK', description: 'Private consortium — Engineering & Architecture' },
  { code: 'NEET', label: 'NEET', description: 'Medical, Dental & AYUSH admissions' },
];

interface ExamTabsProps {
  value: ExamCode;
  onChange: (exam: ExamCode) => void;
}

export function ExamTabs({ value, onChange }: ExamTabsProps) {
  return (
    <div role="tablist" aria-label="Select entrance exam" className="colleges-exam-tabs">
      {EXAMS.map((exam) => {
        const isActive = exam.code === value;
        return (
          <button
            key={exam.code}
            role="tab"
            type="button"
            aria-selected={isActive}
            className="colleges-exam-tab"
            data-active={isActive || undefined}
            onClick={() => onChange(exam.code)}
          >
            <span className="colleges-exam-tab-label">{exam.label}</span>
            <span className="colleges-exam-tab-desc">{exam.description}</span>
          </button>
        );
      })}
    </div>
  );
}
