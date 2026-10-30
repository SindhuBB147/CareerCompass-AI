'use client';

import { Fragment } from 'react';
import type { Step1Data } from '../types';

const LANGUAGES = ['English', 'Kannada', 'Hindi', 'Telugu', 'Tamil', 'Marathi'];

export function Step1Personal({ data, onChange }: { data: Step1Data; onChange: (patch: Partial<Step1Data>) => void }) {
  return (
    <Fragment>
      <div className="wizard-step-heading">
        <h2 className="font-serif">Personal Information</h2>
        <p>Tell us a little about yourself so we can personalize your experience.</p>
      </div>

      <div className="wizard-photo-upload">
        <div className="wizard-photo-preview">
          {data.photoUrl ? <img src={data.photoUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : '👤'}
        </div>
        <div className="wizard-field" style={{ flex: 1 }}>
          <label className="wizard-label" htmlFor="photoUrl">Photo URL</label>
          <input
            id="photoUrl" className="input-editorial" value={data.photoUrl}
            onChange={e => onChange({ photoUrl: e.target.value })} placeholder="https://…"
          />
          <span className="wizard-hint">Paste a link to your photo (upload support coming soon).</span>
        </div>
      </div>

      <div className="wizard-grid-2">
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="fullName">Full Name</label>
          <input id="fullName" className="input-editorial" value={data.fullName} onChange={e => onChange({ fullName: e.target.value })} required />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="gender">Gender</label>
          <select id="gender" className="input-editorial" value={data.gender} onChange={e => onChange({ gender: e.target.value })}>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
          </select>
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="dob">Date of Birth</label>
          <input id="dob" type="date" className="input-editorial" value={data.dob} onChange={e => onChange({ dob: e.target.value })} />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="phone">Phone</label>
          <input id="phone" type="tel" className="input-editorial" value={data.phone} onChange={e => onChange({ phone: e.target.value })} placeholder="+91 9XXXXXXXXX" />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="state">State</label>
          <input id="state" className="input-editorial" value={data.state} onChange={e => onChange({ state: e.target.value })} placeholder="Karnataka" />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="district">District</label>
          <input id="district" className="input-editorial" value={data.district} onChange={e => onChange({ district: e.target.value })} />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="city">City</label>
          <input id="city" className="input-editorial" value={data.city} onChange={e => onChange({ city: e.target.value })} />
        </div>
        <div className="wizard-field">
          <label className="wizard-label" htmlFor="pinCode">PIN Code</label>
          <input id="pinCode" className="input-editorial" value={data.pinCode} onChange={e => onChange({ pinCode: e.target.value })} maxLength={10} />
        </div>
        <div className="wizard-field" data-span="2">
          <label className="wizard-label" htmlFor="preferredLanguage">Preferred Language</label>
          <select id="preferredLanguage" className="input-editorial" value={data.preferredLanguage} onChange={e => onChange({ preferredLanguage: e.target.value })}>
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>
    </Fragment>
  );
}
