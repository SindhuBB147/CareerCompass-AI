'use client';

import { Fragment } from 'react';
import type { Step6Data } from '../types';
import { TagInput } from '../../../components/auth/TagInput';

const LEARNING_STYLES = ['Visual', 'Reading/Writing', 'Hands-on / Practical', 'Video-based', 'Mixed'];
const LANGUAGES = ['English', 'Kannada', 'Hindi', 'Telugu', 'Tamil'];

export function Step6AI({ data, onChange }: { data: Step6Data; onChange: (patch: Partial<Step6Data>) => void }) {
  return (
    <Fragment>
      <div className="wizard-step-heading">
        <h2 className="font-serif">AI Personalization</h2>
        <p>The more our AI Counsellor knows about you, the sharper its recommendations get.</p>
      </div>

      <div className="wizard-field">
        <label className="wizard-label" htmlFor="careerGoal">Career Goal</label>
        <input id="careerGoal" className="input-editorial" value={data.careerGoal} onChange={e => onChange({ careerGoal: e.target.value })} placeholder="e.g. Become a software engineer at a top product company" />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Dream Companies</label>
        <TagInput values={data.dreamCompanies} onChange={v => onChange({ dreamCompanies: v })} placeholder="e.g. Google, ISRO, Infosys…" />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Interest Areas</label>
        <TagInput values={data.interestAreas} onChange={v => onChange({ interestAreas: v })} placeholder="e.g. AI, Robotics, Finance…" />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Skills</label>
        <TagInput values={data.skills} onChange={v => onChange({ skills: v })} placeholder="e.g. Problem solving, Public speaking…" />
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Programming Languages</label>
        <TagInput values={data.programmingLanguages} onChange={v => onChange({ programmingLanguages: v })} placeholder="e.g. Python, Java, C++…" />
      </div>

      <div className="wizard-grid-2">
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="learningStyle">Preferred Learning Style</label>
          <select id="learningStyle" className="input-editorial" value={data.learningStyle} onChange={e => onChange({ learningStyle: e.target.value })}>
            <option value="">Select…</option>
            {LEARNING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="communicationLanguage">Preferred Communication Language</label>
          <select id="communicationLanguage" className="input-editorial" value={data.communicationLanguage} onChange={e => onChange({ communicationLanguage: e.target.value })}>
            <option value="">Select…</option>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <label className="auth-checkbox-row">
        <input type="checkbox" checked={data.receiveAiSuggestions} onChange={e => onChange({ receiveAiSuggestions: e.target.checked })} />
        Send me personalized AI recommendations
      </label>
      <label className="auth-checkbox-row">
        <input type="checkbox" checked={data.receiveNotifications} onChange={e => onChange({ receiveNotifications: e.target.checked })} />
        Notify me about deadlines, scholarships, and roadmap updates
      </label>
    </Fragment>
  );
}
