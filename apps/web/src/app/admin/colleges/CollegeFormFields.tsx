'use client';

import React from 'react';
import type { CreateCollegeInput } from '../../../lib/admin-api';

export interface CollegeFormState {
  name: string; state: string; city: string; district: string;
  collegeType: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  establishedYear: string; aicteApproved: boolean;
  bannerImage: string; logo: string; description: string; highlights: string;
  naac: string; nirfRank: string; nbaCourses: string;
  website: string; email: string; phone: string; address: string;
  boysHostel: boolean; girlsHostel: boolean; hostelCapacity: string; messDetails: string; amenities: string;
}

export const EMPTY_COLLEGE_FORM: CollegeFormState = {
  name: '', state: 'Karnataka', city: 'Bengaluru', district: '',
  collegeType: 'Autonomous', establishedYear: '', aicteApproved: true,
  bannerImage: '', logo: '', description: '', highlights: '',
  naac: '', nirfRank: '', nbaCourses: '',
  website: '', email: '', phone: '', address: '',
  boysHostel: true, girlsHostel: true, hostelCapacity: '', messDetails: '', amenities: '',
};

function splitCsv(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function collegeFormToPayload(f: CollegeFormState): CreateCollegeInput {
  return {
    name: f.name, state: f.state, city: f.city, district: f.district || undefined,
    collegeType: f.collegeType,
    establishedYear: f.establishedYear ? Number(f.establishedYear) : undefined,
    aicteApproved: f.aicteApproved,
    bannerImage: f.bannerImage || undefined, logo: f.logo || undefined,
    description: f.description || undefined,
    highlights: f.highlights ? splitCsv(f.highlights) : undefined,
    accreditation: {
      naac: f.naac || undefined,
      nirfRank: f.nirfRank ? Number(f.nirfRank) : undefined,
      nbaCourses: f.nbaCourses ? splitCsv(f.nbaCourses) : undefined,
    },
    contact: {
      website: f.website || undefined, email: f.email || undefined,
      phone: f.phone || undefined, address: f.address || undefined,
    },
    hostelInfo: {
      boysHostel: f.boysHostel, girlsHostel: f.girlsHostel,
      capacity: f.hostelCapacity ? Number(f.hostelCapacity) : undefined,
      messDetails: f.messDetails || undefined,
      amenities: f.amenities ? splitCsv(f.amenities) : undefined,
    },
  } as CreateCollegeInput;
}

interface CollegeFormFieldsProps {
  state: CollegeFormState;
  onChange: (state: CollegeFormState) => void;
}

export function CollegeFormFields({ state, onChange }: CollegeFormFieldsProps) {
  const set = <K extends keyof CollegeFormState>(key: K, value: CollegeFormState[K]) => onChange({ ...state, [key]: value });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '60vh', overflowY: 'auto', paddingRight: '4px' }}>
      <div className="admin-form-grid">
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-name">College Name</label>
          <input id="cf-name" className="input-editorial" value={state.name} onChange={e => set('name', e.target.value)} required />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-state">State</label>
          <input id="cf-state" className="input-editorial" value={state.state} onChange={e => set('state', e.target.value)} required />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-city">City</label>
          <input id="cf-city" className="input-editorial" value={state.city} onChange={e => set('city', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-district">District</label>
          <input id="cf-district" className="input-editorial" value={state.district} onChange={e => set('district', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-type">Ownership / Type</label>
          <select id="cf-type" className="input-editorial" value={state.collegeType} onChange={e => set('collegeType', e.target.value as CollegeFormState['collegeType'])}>
            <option value="Government">Government</option>
            <option value="Private">Private</option>
            <option value="Autonomous">Autonomous</option>
            <option value="Deemed">Deemed / University</option>
          </select>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-year">Established Year</label>
          <input id="cf-year" type="number" className="input-editorial" value={state.establishedYear} onChange={e => set('establishedYear', e.target.value)} />
        </div>
        <div className="admin-checkbox-row">
          <input id="cf-aicte" type="checkbox" className="admin-checkbox" checked={state.aicteApproved} onChange={e => set('aicteApproved', e.target.checked)} />
          <label htmlFor="cf-aicte">AICTE Approved</label>
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-banner">Banner Image URL</label>
          <input id="cf-banner" className="input-editorial" value={state.bannerImage} onChange={e => set('bannerImage', e.target.value)} placeholder="https://…" />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-logo">Logo URL</label>
          <input id="cf-logo" className="input-editorial" value={state.logo} onChange={e => set('logo', e.target.value)} placeholder="https://…" />
        </div>
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-desc">Description</label>
          <textarea id="cf-desc" className="input-editorial" rows={3} value={state.description} onChange={e => set('description', e.target.value)} style={{ resize: 'vertical' }} />
        </div>
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-highlights">Highlights (comma-separated)</label>
          <input id="cf-highlights" className="input-editorial" value={state.highlights} onChange={e => set('highlights', e.target.value)} placeholder="NIRF #89, NAAC A++, 98% Placement" />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-naac">NAAC Grade</label>
          <input id="cf-naac" className="input-editorial" value={state.naac} onChange={e => set('naac', e.target.value)} placeholder="A++" />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-nirf">NIRF Rank</label>
          <input id="cf-nirf" type="number" className="input-editorial" value={state.nirfRank} onChange={e => set('nirfRank', e.target.value)} />
        </div>
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-nba">NBA Accredited Departments (comma-separated)</label>
          <input id="cf-nba" className="input-editorial" value={state.nbaCourses} onChange={e => set('nbaCourses', e.target.value)} placeholder="CSE, ECE, Mechanical" />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-website">Website</label>
          <input id="cf-website" className="input-editorial" value={state.website} onChange={e => set('website', e.target.value)} placeholder="https://…" />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-email">Admissions Email</label>
          <input id="cf-email" type="email" className="input-editorial" value={state.email} onChange={e => set('email', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-phone">Phone</label>
          <input id="cf-phone" className="input-editorial" value={state.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-address">Address</label>
          <input id="cf-address" className="input-editorial" value={state.address} onChange={e => set('address', e.target.value)} />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group" data-span="2" style={{ display: 'flex', flexDirection: 'row', gap: '20px' }}>
          <div className="admin-checkbox-row">
            <input id="cf-boys" type="checkbox" className="admin-checkbox" checked={state.boysHostel} onChange={e => set('boysHostel', e.target.checked)} />
            <label htmlFor="cf-boys">Boys Hostel</label>
          </div>
          <div className="admin-checkbox-row">
            <input id="cf-girls" type="checkbox" className="admin-checkbox" checked={state.girlsHostel} onChange={e => set('girlsHostel', e.target.checked)} />
            <label htmlFor="cf-girls">Girls Hostel</label>
          </div>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-capacity">Hostel Capacity</label>
          <input id="cf-capacity" type="number" className="input-editorial" value={state.hostelCapacity} onChange={e => set('hostelCapacity', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-mess">Mess Details</label>
          <input id="cf-mess" className="input-editorial" value={state.messDetails} onChange={e => set('messDetails', e.target.value)} />
        </div>
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-amenities">Hostel Amenities (comma-separated)</label>
          <input id="cf-amenities" className="input-editorial" value={state.amenities} onChange={e => set('amenities', e.target.value)} placeholder="WiFi, Gym, Laundry" />
        </div>
      </div>
    </div>
  );
}
