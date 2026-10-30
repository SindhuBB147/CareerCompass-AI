'use client';

import { Fragment } from 'react';
import type { Step2Data } from '../types';

export function Step2Academic({ data, onChange }: { data: Step2Data; onChange: (patch: Partial<Step2Data>) => void }) {
  return (
    <Fragment>
      <div className="wizard-step-heading">
        <h2 className="font-serif">Academic Information</h2>
        <p>Your academic record helps us match you to eligible colleges and courses.</p>
      </div>

      <div className="wizard-grid-2">
        <div className="wizard-field" data-span="2">
          <label className="wizard-label" htmlFor="currentQualification">Current Qualification</label>
          <select
            id="currentQualification" className="input-editorial" value={data.currentQualification}
            onChange={e => onChange({ currentQualification: e.target.value })}
          >
            <option value="">Select…</option>
            <option value="10th">10th (SSLC)</option>
            <option value="12th">12th / PUC</option>
            <option value="diploma">Diploma</option>
            <option value="undergraduate">Undergraduate</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="wizard-field">
          <label className="wizard-label" htmlFor="tenthPercentage">10th Percentage</label>
          <input id="tenthPercentage" type="number" min={0} max={100} step={0.01} className="input-editorial" value={data.tenthPercentage} onChange={e => onChange({ tenthPercentage: e.target.value })} />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="twelfthPercentage">12th Percentage</label>
          <input id="twelfthPercentage" type="number" min={0} max={100} step={0.01} className="input-editorial" value={data.twelfthPercentage} onChange={e => onChange({ twelfthPercentage: e.target.value })} />
        </div>

        <div className="wizard-field">
          <label className="wizard-label" htmlFor="diploma">Diploma (if applicable)</label>
          <input id="diploma" className="input-editorial" value={data.diploma} onChange={e => onChange({ diploma: e.target.value })} placeholder="e.g. Mechanical Engineering" />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="pucBoard">PUC Board</label>
          <input id="pucBoard" className="input-editorial" value={data.pucBoard} onChange={e => onChange({ pucBoard: e.target.value })} placeholder="e.g. Karnataka State Board" />
        </div>

        <div className="wizard-field">
          <label className="wizard-label" htmlFor="yearOfPassing">Year of Passing</label>
          <input id="yearOfPassing" type="number" className="input-editorial" value={data.yearOfPassing} onChange={e => onChange({ yearOfPassing: e.target.value })} placeholder="2025" />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="gapYears">Gap Years</label>
          <input id="gapYears" type="number" min={0} max={10} className="input-editorial" value={data.gapYears} onChange={e => onChange({ gapYears: e.target.value })} />
        </div>
      </div>
    </Fragment>
  );
}
