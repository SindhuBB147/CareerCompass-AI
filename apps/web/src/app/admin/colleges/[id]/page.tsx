'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useAdminAuth } from '../../../../contexts/AdminAuthContext';
import { ApiError } from '../../../../lib/api-client';
import { adminCollegesApi, adminScholarshipsApi, type Scholarship } from '../../../../lib/admin-api';
import { collegesApi, type College } from '../../../../lib/colleges-api';
import { AdminModal } from '../../../../components/admin/AdminModal';
import { CollegeFormFields, EMPTY_COLLEGE_FORM, type CollegeFormState, collegeFormToPayload, collegeToFormState } from '../CollegeFormFields';
import { CoursesManagerModal } from '../CoursesManagerModal';
import { PlacementsManagerModal } from '../PlacementsManagerModal';
import { ImagesManagerModal } from '../ImagesManagerModal';
import { CutoffsManagerTab } from '../CutoffsManagerTab';
import { SeatMatrixModal } from '../SeatMatrixModal';
import { CompletenessBreakdown, computeCompleteness } from '../CompletenessBreakdown';

type Tab = 'overview' | 'courses' | 'cutoffs' | 'placements' | 'hostel-fees' | 'facilities' | 'admission' | 'scholarships' | 'images';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'courses', label: 'Courses & Seats' },
  { key: 'cutoffs', label: 'Cutoffs' },
  { key: 'placements', label: 'Placements' },
  { key: 'hostel-fees', label: 'Hostel & Fees' },
  { key: 'facilities', label: 'Facilities' },
  { key: 'admission', label: 'Admission' },
  { key: 'scholarships', label: 'Scholarships' },
  { key: 'images', label: 'Images' },
];

function formatLakh(amount?: number | null): string {
  if (!amount) return '—';
  return `₹${(amount / 100000).toFixed(2)}L`;
}

function CollegeDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const { adminToken } = useAdminAuth();

  const [college, setCollege] = useState<College | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'overview');
  const [cutoffCount, setCutoffCount] = useState<number | null>(null);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<CollegeFormState>(EMPTY_COLLEGE_FORM);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [showCourses, setShowCourses] = useState(false);
  const [showPlacements, setShowPlacements] = useState(false);
  const [showImages, setShowImages] = useState(false);
  const [seatMatrixCourse, setSeatMatrixCourse] = useState<College['courses'][number] | null>(null);

  const [scholarships, setScholarships] = useState<Scholarship[] | null>(null);
  const [scholarshipsLoading, setScholarshipsLoading] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setIsLoading(true);
    collegesApi.getDetail(id)
      .then(setCollege)
      .catch(() => setLoadError('Could not load this college.'))
      .finally(() => setIsLoading(false));
    collegesApi.getCutoffSummary(id).then(s => setCutoffCount(s.totalRecords)).catch(() => setCutoffCount(0));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (tab !== 'scholarships' || scholarships !== null || !adminToken) return;
    setScholarshipsLoading(true);
    adminScholarshipsApi.list(adminToken, { isActive: true, limit: 100 })
      .then(res => setScholarships(res.scholarships))
      .catch(() => setScholarships([]))
      .finally(() => setScholarshipsLoading(false));
  }, [tab, scholarships, adminToken]);

  const openEdit = () => {
    if (!college) return;
    setEditForm(collegeToFormState(college));
    setEditError(null);
    setShowEdit(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !college) return;
    setIsSubmitting(true);
    setEditError(null);
    try {
      await adminCollegesApi.update(adminToken, college.id || college._id, collegeFormToPayload(editForm));
      setShowEdit(false);
      load();
    } catch (err) {
      setEditError(err instanceof ApiError ? err.message : 'Could not save college.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="admin-loading">Loading college…</div>;
  if (loadError || !college) {
    return (
      <div className="card-editorial admin-empty-state">
        <p>{loadError ?? 'College not found.'}</p>
        <Link href="/admin/colleges" className="btn-editorial-secondary">← Back to Colleges</Link>
      </div>
    );
  }

  const completeness = computeCompleteness(college, cutoffCount);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <Link href="/admin/colleges" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>← Back to Colleges</Link>
          <h1 className="font-serif admin-page-title" style={{ marginTop: '6px' }}>{college.name}</h1>
          <p className="admin-page-subtitle">
            {college.collegeId ? `${college.collegeId} · ` : ''}{college.city}, {college.state} · {college.collegeType}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <CompletenessBreakdown result={completeness} />
          <button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openEdit}>Edit College</button>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button key={t.key} className="admin-tab" data-active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="admin-form-grid">
            <div><strong>Established</strong><div>{college.establishedYear ?? '—'}</div></div>
            <div><strong>AICTE Approved</strong><div>{college.aicteApproved ? 'Yes' : 'No'}</div></div>
            <div><strong>NAAC</strong><div>{college.accreditation?.naac ?? '—'}</div></div>
            <div><strong>NIRF Rank</strong><div>{college.accreditation?.nirfRank ? `#${college.accreditation.nirfRank}` : '—'}</div></div>
            <div><strong>NBA Courses</strong><div>{(college.accreditation?.nbaCourses ?? []).join(', ') || '—'}</div></div>
            <div><strong>Affiliated University</strong><div>{college.affiliatedUniversity || '—'}</div></div>
            <div><strong>Website</strong><div>{college.contact?.website || '—'}</div></div>
            <div><strong>Email</strong><div>{college.contact?.email || '—'}</div></div>
            <div><strong>Phone</strong><div>{college.contact?.phone || '—'}</div></div>
            <div><strong>Address</strong><div>{college.contact?.address || '—'}</div></div>
            <div><strong>Verified</strong><div>{college.isVerified ? 'Yes' : 'No'}</div></div>
          </div>
          {college.description && (
            <div>
              <strong>Description</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>{college.description}</p>
            </div>
          )}
          {college.highlights.length > 0 && (
            <div>
              <strong>Highlights</strong>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)' }}>{college.highlights.join(' · ')}</p>
            </div>
          )}
        </div>
      )}

      {tab === 'courses' && (
        <div className="card-editorial">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="font-serif" style={{ margin: 0, fontSize: '16px' }}>Courses & Seats</h3>
            <button className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setShowCourses(true)}>Manage Courses</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Degree</th><th>Intake</th><th>Sanctioned Seats</th><th>Fee/yr</th><th>Exams</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {college.courses.map((c) => (
                  <tr key={c.courseId}>
                    <td>{c.courseId}</td>
                    <td>{c.name}</td>
                    <td>{c.degreeType}</td>
                    <td>{c.intake}</td>
                    <td>{c.seatMatrix?.totalSeats ?? c.sanctionedIntake ?? '—'}</td>
                    <td>{formatLakh(c.feePerYear)}</td>
                    <td>{c.examsAccepted.join(', ')}</td>
                    <td><button className="admin-table-action-btn" onClick={() => setSeatMatrixCourse(c)}>Edit Seats</button></td>
                  </tr>
                ))}
                {college.courses.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No courses added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'cutoffs' && <CutoffsManagerTab collegeId={college.id || college._id} courses={college.courses} />}

      {tab === 'placements' && (
        <div className="card-editorial">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="font-serif" style={{ margin: 0, fontSize: '16px' }}>Placements</h3>
            <button className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setShowPlacements(true)}>Manage Placements</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Year</th><th>Highest</th><th>Average</th><th>Median</th><th>Placement %</th><th>Top Recruiters</th></tr>
              </thead>
              <tbody>
                {college.placementSummary.map((p) => (
                  <tr key={p.year}>
                    <td>{p.year}</td>
                    <td>{formatLakh(p.highestPackage)}</td>
                    <td>{formatLakh(p.averagePackage)}</td>
                    <td>{formatLakh(p.medianPackage)}</td>
                    <td>{p.placementPercentage}%</td>
                    <td>{(p.topRecruiters ?? []).slice(0, 3).join(', ')}{(p.topRecruiters ?? []).length > 3 ? '…' : ''}</td>
                  </tr>
                ))}
                {college.placementSummary.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No placement data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'hostel-fees' && (
        <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <h3 className="font-serif" style={{ margin: '0 0 10px', fontSize: '16px' }}>Hostel</h3>
            <div className="admin-form-grid">
              <div><strong>Boys Hostel</strong><div>{college.hostelInfo?.boysHostel ? 'Yes' : 'No'}</div></div>
              <div><strong>Girls Hostel</strong><div>{college.hostelInfo?.girlsHostel ? 'Yes' : 'No'}</div></div>
              <div><strong>Capacity</strong><div>{college.hostelInfo?.capacity || '—'}</div></div>
              <div><strong>Mess</strong><div>{college.hostelInfo?.messDetails || '—'}</div></div>
              <div><strong>Amenities</strong><div>{(college.hostelInfo?.amenities ?? []).join(', ') || '—'}</div></div>
              <div><strong>Hostel Fee/yr</strong><div>{formatLakh(college.hostelInfo?.hostelFeePerYear)}</div></div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Hostel fields are edited via <button type="button" className="admin-link-btn" style={{ padding: 0, font: 'inherit', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={openEdit}>Edit College</button>.
            </p>
          </div>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '18px' }}>
            <h3 className="font-serif" style={{ margin: '0 0 10px', fontSize: '16px' }}>Fees</h3>
            <div className="admin-form-grid">
              <div><strong>Tuition Fee</strong><div>{formatLakh(college.feeBreakdown?.tuitionFee)}</div></div>
              <div><strong>Hostel Fee</strong><div>{formatLakh(college.feeBreakdown?.hostelFee)}</div></div>
              <div><strong>Mess Fee</strong><div>{formatLakh(college.feeBreakdown?.messFee)}</div></div>
              <div><strong>Other Charges</strong><div>{formatLakh(college.feeBreakdown?.otherCharges)}</div></div>
              <div><strong>Total Annual Fee</strong><div>{formatLakh(college.feeBreakdown?.totalAnnualFee)}</div></div>
              <div><strong>Academic Year</strong><div>{college.feeBreakdown?.academicYear || '—'}</div></div>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Fees are edited via <button type="button" style={{ padding: 0, font: 'inherit', color: 'var(--accent-blue)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={openEdit}>Edit College</button>.
            </p>
          </div>
        </div>
      )}

      {tab === 'facilities' && (
        <div className="card-editorial">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="font-serif" style={{ margin: 0, fontSize: '16px' }}>Facilities</h3>
            <button className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={openEdit}>Edit College</button>
          </div>
          {(college.campus?.facilities ?? []).length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {college.campus!.facilities.map(f => <span key={f} className="admin-status-badge admin-status-info">{f}</span>)}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No facilities listed yet.</p>
          )}
          {college.campus?.description && (
            <p style={{ marginTop: '14px', color: 'var(--text-secondary)' }}>{college.campus.description}</p>
          )}
        </div>
      )}

      {tab === 'admission' && (
        <div className="card-editorial">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="font-serif" style={{ margin: 0, fontSize: '16px' }}>Admission Information</h3>
            <button className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={openEdit}>Edit College</button>
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Route</th><th>Eligibility</th><th>Process</th></tr></thead>
              <tbody>
                {(college.admissionRoutes ?? []).map((r, i) => (
                  <tr key={i}><td>{r.route}</td><td>{r.eligibility || '—'}</td><td>{r.process || '—'}</td></tr>
                ))}
                {(college.admissionRoutes ?? []).length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No admission routes added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'scholarships' && (
        <div className="card-editorial">
          <h3 className="font-serif" style={{ margin: '0 0 6px', fontSize: '16px' }}>Matching Scholarships</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px' }}>
            Scholarships aren't manually assigned per college — this list is computed from each scholarship's own eligibility rules (state and, when set, accepted exams) matched against this college.
          </p>
          {scholarshipsLoading ? (
            <p className="admin-loading">Loading…</p>
          ) : (
            (() => {
              const examSet = new Set(college.courses.flatMap(c => c.examsAccepted.map(e => e.toUpperCase())));
              const matches = (scholarships ?? []).filter(s => {
                const states = s.eligibility?.states ?? [];
                const stateOk = states.length === 0 || states.some(st => st.toLowerCase() === college.state.toLowerCase());
                const exams = s.eligibility?.exams ?? [];
                const examOk = exams.length === 0 || exams.some(e => examSet.has(e.toUpperCase()));
                return stateOk && examOk;
              });
              if (matches.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No matching scholarships found.</p>;
              return (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Name</th><th>Provider</th><th>Award</th><th>Deadline</th></tr></thead>
                    <tbody>
                      {matches.map(s => (
                        <tr key={s._id ?? s.id}>
                          <td>{s.name}</td>
                          <td>{s.providerName || s.provider}</td>
                          <td>{s.awardAmount?.displayText || '—'}</td>
                          <td>{s.applicationDeadline ? new Date(s.applicationDeadline).toLocaleDateString('en-IN') : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()
          )}
        </div>
      )}

      {tab === 'images' && (
        <div className="card-editorial">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="font-serif" style={{ margin: 0, fontSize: '16px' }}>Images</h3>
            <button className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px' }} onClick={() => setShowImages(true)}>Manage Images</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px' }}>
            {college.gallery.map((img) => (
              <div key={img.id ?? img.url} style={{ position: 'relative', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md, 8px)', overflow: 'hidden' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumbnailUrl || img.url} alt={img.altText || img.title} style={{ width: '100%', height: '110px', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '6px 8px', fontSize: '11px' }}>
                  {img.isPrimary && <span className="admin-status-badge admin-status-success" style={{ marginRight: '4px' }}>Primary</span>}
                  <span className="admin-status-badge admin-status-neutral">{img.category}</span>
                </div>
              </div>
            ))}
            {college.gallery.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No images uploaded yet.</p>}
          </div>
        </div>
      )}

      {showEdit && (
        <AdminModal title="Edit College" onClose={() => setShowEdit(false)} onSubmit={handleEditSubmit} isSubmitting={isSubmitting} error={editError} submitLabel="Save Changes" wide>
          <CollegeFormFields state={editForm} onChange={setEditForm} />
        </AdminModal>
      )}
      {showCourses && <CoursesManagerModal collegeId={college.id || college._id} onClose={() => { setShowCourses(false); load(); }} />}
      {showPlacements && <PlacementsManagerModal collegeId={college.id || college._id} onClose={() => { setShowPlacements(false); load(); }} />}
      {showImages && <ImagesManagerModal collegeId={college.id || college._id} onClose={() => { setShowImages(false); load(); }} />}
      {seatMatrixCourse && (
        <SeatMatrixModal collegeId={college.id || college._id} course={seatMatrixCourse} onClose={() => { setSeatMatrixCourse(null); load(); }} />
      )}
    </div>
  );
}

export default function CollegeDetailPage() {
  return (
    <Suspense fallback={<div className="admin-loading">Loading college…</div>}>
      <CollegeDetailContent />
    </Suspense>
  );
}
