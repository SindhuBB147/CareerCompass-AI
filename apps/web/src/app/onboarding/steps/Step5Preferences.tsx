'use client';

import { Fragment } from 'react';
import type { Step5Data } from '../types';
import { TagInput } from '../../../components/auth/TagInput';

export function Step5Preferences({ data, onChange }: { data: Step5Data; onChange: (patch: Partial<Step5Data>) => void }) {
  return (
    <Fragment>
      <div className="wizard-step-heading">
        <h2 className="font-serif">Career Preferences</h2>
        <p>Help our recommendation engine narrow down the right colleges and courses for you.</p>
      </div>

      <div className="wizard-grid-2">
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="preferredExam">Preferred Exam</label>
          <input id="preferredExam" className="input-editorial" value={data.preferredExam} onChange={e => onChange({ preferredExam: e.target.value })} placeholder="KCET" />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="preferredDiscipline">Preferred Discipline</label>
          <input id="preferredDiscipline" className="input-editorial" value={data.preferredDiscipline} onChange={e => onChange({ preferredDiscipline: e.target.value })} placeholder="Computer Science" />
        </div>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Preferred Courses</label>
        <TagInput values={data.preferredCourses} onChange={v => onChange({ preferredCourses: v })} placeholder="e.g. Computer Science, AI & ML…" />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Preferred Colleges</label>
        <TagInput values={data.preferredColleges} onChange={v => onChange({ preferredColleges: v })} placeholder="e.g. RVCE, BMSCE…" />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Preferred Cities</label>
        <TagInput values={data.preferredCities} onChange={v => onChange({ preferredCities: v })} placeholder="e.g. Bengaluru, Mysuru…" />
      </div>

      <div className="wizard-grid-2">
        <div className="wizard-field">
          <label className="wizard-label">Government / Private Preference</label>
          <div className="wizard-chip-group">
            {['government', 'private', 'any'].map(opt => (
              <button key={opt} type="button" className="wizard-chip" data-selected={data.collegeType === opt} onClick={() => onChange({ collegeType: opt })}>
                {opt === 'any' ? 'No Preference' : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="budgetMax">Budget (Max, per year ₹)</label>
          <input id="budgetMax" type="number" min={0} className="input-editorial" value={data.budgetMax} onChange={e => onChange({ budgetMax: e.target.value })} placeholder="200000" />
        </div>
      </div>

      <div className="wizard-grid-2">
        <label className="auth-checkbox-row">
          <input type="checkbox" checked={data.hostelRequired} onChange={e => onChange({ hostelRequired: e.target.checked })} />
          I&apos;ll need hostel accommodation
        </label>
        <label className="auth-checkbox-row">
          <input type="checkbox" checked={data.loanRequired} onChange={e => onChange({ loanRequired: e.target.checked })} />
          I may need an education loan
        </label>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">After Graduation, I&apos;m Most Interested In</label>
        <div className="wizard-chip-group">
          {[
            { v: 'higher_studies', l: 'Higher Studies' },
            { v: 'job', l: 'Job' },
            { v: 'entrepreneurship', l: 'Entrepreneurship' },
            { v: 'research', l: 'Research' },
          ].map(opt => (
            <button key={opt.v} type="button" className="wizard-chip" data-selected={data.postGraduationPlan === opt.v} onClick={() => onChange({ postGraduationPlan: opt.v })}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>
    </Fragment>
  );
}
