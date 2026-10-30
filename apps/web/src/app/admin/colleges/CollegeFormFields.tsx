'use client';

import React from 'react';
import type { CreateCollegeInput } from '../../../lib/admin-api';
import type { College } from '../../../lib/colleges-api';

export interface CollegeFormState {
  collegeId: string;
  name: string; state: string; city: string; district: string; affiliatedUniversity: string;
  collegeType: 'Government' | 'Private' | 'Autonomous' | 'Deemed';
  establishedYear: string; aicteApproved: boolean;
  bannerImage: string; logo: string; description: string; highlights: string;
  latitude: string; longitude: string;
  naac: string; nirfRank: string; nbaCourses: string;
  website: string; email: string; phone: string; address: string;
  boysHostel: boolean; girlsHostel: boolean; hostelCapacity: string; messDetails: string; amenities: string;
  roomTypes: string; hostelFeePerYear: string; hostelFeeAcademicYear: string;
  tuitionFee: string; hostelFee: string; messFee: string; otherCharges: string; feeAcademicYear: string;
  facilities: string;
  admissionRoutes: Array<{ route: string; eligibility: string; process: string }>;
}

export const EMPTY_COLLEGE_FORM: CollegeFormState = {
  collegeId: '',
  name: '', state: 'Karnataka', city: 'Bengaluru', district: '', affiliatedUniversity: '',
  collegeType: 'Autonomous', establishedYear: '', aicteApproved: true,
  bannerImage: '', logo: '', description: '', highlights: '',
  latitude: '', longitude: '',
  naac: '', nirfRank: '', nbaCourses: '',
  website: '', email: '', phone: '', address: '',
  boysHostel: true, girlsHostel: true, hostelCapacity: '', messDetails: '', amenities: '',
  roomTypes: '', hostelFeePerYear: '', hostelFeeAcademicYear: '',
  tuitionFee: '', hostelFee: '', messFee: '', otherCharges: '', feeAcademicYear: '',
  facilities: '',
  admissionRoutes: [],
};

function splitCsv(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export function collegeToFormState(college: College): CollegeFormState {
  return {
    collegeId: college.collegeId ?? '',
    name: college.name, state: college.state, city: college.city, district: college.district ?? '',
    affiliatedUniversity: college.affiliatedUniversity ?? '',
    collegeType: college.collegeType, establishedYear: String(college.establishedYear ?? ''),
    aicteApproved: college.aicteApproved ?? false, bannerImage: college.bannerImage ?? '', logo: college.logo ?? '',
    description: college.description ?? '', highlights: (college.highlights ?? []).join(', '),
    latitude: college.latitude != null ? String(college.latitude) : '', longitude: college.longitude != null ? String(college.longitude) : '',
    naac: college.accreditation?.naac ?? '', nirfRank: String(college.accreditation?.nirfRank ?? ''),
    nbaCourses: (college.accreditation?.nbaCourses ?? []).join(', '),
    website: college.contact?.website ?? '', email: college.contact?.email ?? '',
    phone: college.contact?.phone ?? '', address: college.contact?.address ?? '',
    boysHostel: college.hostelInfo?.boysHostel ?? false, girlsHostel: college.hostelInfo?.girlsHostel ?? false,
    hostelCapacity: String(college.hostelInfo?.capacity ?? ''), messDetails: college.hostelInfo?.messDetails ?? '',
    amenities: (college.hostelInfo?.amenities ?? []).join(', '),
    roomTypes: (college.hostelInfo?.roomTypes ?? []).join(', '),
    hostelFeePerYear: college.hostelInfo?.hostelFeePerYear != null ? String(college.hostelInfo.hostelFeePerYear) : '',
    hostelFeeAcademicYear: college.hostelInfo?.hostelFeeAcademicYear ?? '',
    tuitionFee: college.feeBreakdown?.tuitionFee ? String(college.feeBreakdown.tuitionFee) : '',
    hostelFee: college.feeBreakdown?.hostelFee ? String(college.feeBreakdown.hostelFee) : '',
    messFee: college.feeBreakdown?.messFee ? String(college.feeBreakdown.messFee) : '',
    otherCharges: college.feeBreakdown?.otherCharges ? String(college.feeBreakdown.otherCharges) : '',
    feeAcademicYear: college.feeBreakdown?.academicYear ?? '',
    facilities: (college.campus?.facilities ?? []).join(', '),
    admissionRoutes: (college.admissionRoutes ?? []).map(r => ({ route: r.route, eligibility: r.eligibility ?? '', process: r.process ?? '' })),
  };
}

export function collegeFormToPayload(f: CollegeFormState): CreateCollegeInput {
  return {
    collegeId: f.collegeId.trim() ? f.collegeId.trim().toUpperCase() : undefined,
    name: f.name, state: f.state, city: f.city, district: f.district || undefined,
    affiliatedUniversity: f.affiliatedUniversity || undefined,
    collegeType: f.collegeType,
    establishedYear: f.establishedYear ? Number(f.establishedYear) : undefined,
    aicteApproved: f.aicteApproved,
    bannerImage: f.bannerImage || undefined, logo: f.logo || undefined,
    description: f.description || undefined,
    highlights: f.highlights ? splitCsv(f.highlights) : undefined,
    latitude: f.latitude ? Number(f.latitude) : undefined,
    longitude: f.longitude ? Number(f.longitude) : undefined,
    accreditation: {
      naac: f.naac || undefined,
      nirfRank: f.nirfRank ? Number(f.nirfRank) : undefined,
      nbaCourses: f.nbaCourses ? splitCsv(f.nbaCourses) : undefined,
    },
    contact: {
      website: f.website || undefined, email: f.email || undefined,
      phone: f.phone || undefined, address: f.address || undefined,
    },
    feeBreakdown: {
      tuitionFee: f.tuitionFee ? Number(f.tuitionFee) : undefined,
      hostelFee: f.hostelFee ? Number(f.hostelFee) : undefined,
      messFee: f.messFee ? Number(f.messFee) : undefined,
      otherCharges: f.otherCharges ? Number(f.otherCharges) : undefined,
      academicYear: f.feeAcademicYear || undefined,
    },
    hostelInfo: {
      boysHostel: f.boysHostel, girlsHostel: f.girlsHostel,
      capacity: f.hostelCapacity ? Number(f.hostelCapacity) : undefined,
      messDetails: f.messDetails || undefined,
      amenities: f.amenities ? splitCsv(f.amenities) : undefined,
      roomTypes: f.roomTypes ? splitCsv(f.roomTypes) : undefined,
      hostelFeePerYear: f.hostelFeePerYear ? Number(f.hostelFeePerYear) : undefined,
      hostelFeeAcademicYear: f.hostelFeeAcademicYear || undefined,
    },
    campus: {
      facilities: f.facilities ? splitCsv(f.facilities) : undefined,
    },
    admissionRoutes: f.admissionRoutes.filter(r => r.route.trim()),
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
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-collegeId">College Code</label>
          <input
            id="cf-collegeId" className="input-editorial" value={state.collegeId}
            onChange={e => set('collegeId', e.target.value.toUpperCase())}
            placeholder="e.g. G123" pattern="[A-Za-z]\d{3,}" maxLength={10}
            title="One letter followed by 3 or more digits, e.g. G123"
          />
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Optional — one letter + 3+ digits (e.g. G123). Leave blank to auto-generate later.</span>
        </div>
        <div className="admin-form-group">
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
          <label className="admin-form-label" htmlFor="cf-affiliated">Affiliated University</label>
          <input id="cf-affiliated" className="input-editorial" value={state.affiliatedUniversity} onChange={e => set('affiliatedUniversity', e.target.value)} />
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
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-lat">Latitude</label>
          <input id="cf-lat" type="number" step="any" className="input-editorial" value={state.latitude} onChange={e => set('latitude', e.target.value)} placeholder="12.9716" />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-lng">Longitude</label>
          <input id="cf-lng" type="number" step="any" className="input-editorial" value={state.longitude} onChange={e => set('longitude', e.target.value)} placeholder="77.5946" />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group" data-span="2" style={{ paddingBottom: 0 }}>
          <label className="admin-form-label" style={{ fontWeight: 700 }}>Fee Breakdown</label>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-tuition">Tuition Fee / yr</label>
          <input id="cf-tuition" type="number" className="input-editorial" value={state.tuitionFee} onChange={e => set('tuitionFee', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-hostelfee">Hostel Fee / yr</label>
          <input id="cf-hostelfee" type="number" className="input-editorial" value={state.hostelFee} onChange={e => set('hostelFee', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-messfee">Mess Fee / yr</label>
          <input id="cf-messfee" type="number" className="input-editorial" value={state.messFee} onChange={e => set('messFee', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-othercharges">Other Charges / yr</label>
          <input id="cf-othercharges" type="number" className="input-editorial" value={state.otherCharges} onChange={e => set('otherCharges', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-feeyear">Fee Academic Year</label>
          <input id="cf-feeyear" className="input-editorial" value={state.feeAcademicYear} onChange={e => set('feeAcademicYear', e.target.value)} placeholder="2025-26" />
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
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-hostelfeeyr">Hostel Fee / yr</label>
          <input id="cf-hostelfeeyr" type="number" className="input-editorial" value={state.hostelFeePerYear} onChange={e => set('hostelFeePerYear', e.target.value)} />
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="cf-hostelfeeyear">Hostel Fee Academic Year</label>
          <input id="cf-hostelfeeyear" className="input-editorial" value={state.hostelFeeAcademicYear} onChange={e => set('hostelFeeAcademicYear', e.target.value)} placeholder="2025-26" />
        </div>
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-roomtypes">Hostel Room Types (comma-separated)</label>
          <input id="cf-roomtypes" className="input-editorial" value={state.roomTypes} onChange={e => set('roomTypes', e.target.value)} placeholder="Single, Double Sharing, Triple Sharing" />
        </div>
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-amenities">Hostel Amenities (comma-separated)</label>
          <input id="cf-amenities" className="input-editorial" value={state.amenities} onChange={e => set('amenities', e.target.value)} placeholder="WiFi, Gym, Laundry" />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group" data-span="2">
          <label className="admin-form-label" htmlFor="cf-facilities">Campus Facilities (comma-separated)</label>
          <input id="cf-facilities" className="input-editorial" value={state.facilities} onChange={e => set('facilities', e.target.value)} placeholder="Library, Computer Labs, Sports Complex, Wi-Fi, Auditorium" />
        </div>
      </div>

      <div className="admin-form-grid">
        <div className="admin-form-group" data-span="2" style={{ paddingBottom: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label className="admin-form-label" style={{ fontWeight: 700, margin: 0 }}>Admission Routes</label>
          <button
            type="button"
            className="admin-table-action-btn"
            onClick={() => set('admissionRoutes', [...state.admissionRoutes, { route: '', eligibility: '', process: '' }])}
          >
            + Add Route
          </button>
        </div>
        {state.admissionRoutes.map((r, idx) => (
          <React.Fragment key={idx}>
            <div className="admin-form-group">
              <label className="admin-form-label">Route</label>
              <input
                className="input-editorial" value={r.route} placeholder="KCET / COMEDK / Management"
                onChange={e => set('admissionRoutes', state.admissionRoutes.map((row, i) => i === idx ? { ...row, route: e.target.value } : row))}
              />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Eligibility</label>
              <input
                className="input-editorial" value={r.eligibility}
                onChange={e => set('admissionRoutes', state.admissionRoutes.map((row, i) => i === idx ? { ...row, eligibility: e.target.value } : row))}
              />
            </div>
            <div className="admin-form-group" data-span="2" style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label className="admin-form-label">Process</label>
                <input
                  className="input-editorial" value={r.process}
                  onChange={e => set('admissionRoutes', state.admissionRoutes.map((row, i) => i === idx ? { ...row, process: e.target.value } : row))}
                />
              </div>
              <button type="button" className="admin-table-action-btn" data-danger="true" onClick={() => set('admissionRoutes', state.admissionRoutes.filter((_, i) => i !== idx))}>
                Remove
              </button>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
