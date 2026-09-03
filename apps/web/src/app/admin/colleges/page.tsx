'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCollegesApi, type CreateCollegeInput } from '../../../lib/admin-api';
import type { College } from '../../../lib/colleges-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';
import { CollegeFormFields, EMPTY_COLLEGE_FORM, type CollegeFormState, collegeFormToPayload } from './CollegeFormFields';
import { CoursesManagerModal } from './CoursesManagerModal';
import { PlacementsManagerModal } from './PlacementsManagerModal';

function formatLakh(amount?: number): string {
  if (!amount) return '—';
  return `₹${(amount / 100000).toFixed(2)}L`;
}

function CollegesAdminContent() {
  const { adminToken } = useAdminAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [colleges, setColleges] = useState<College[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  const [formState, setFormState] = useState<CollegeFormState>(EMPTY_COLLEGE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [coursesCollegeId, setCoursesCollegeId] = useState<string | null>(null);
  const [placementsCollegeId, setPlacementsCollegeId] = useState<string | null>(null);

  const loadColleges = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminCollegesApi.search(adminToken, { q: debouncedSearch || undefined, page, limit: 15 })
      .then(res => {
        setColleges(res.results);
        setTotalResults(res.totalResults);
        setTotalPages(res.totalPages);
      })
      .catch(() => { setColleges([]); setTotalResults(0); setTotalPages(1); })
      .finally(() => setIsLoading(false));
  }, [adminToken, debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { loadColleges(); }, [loadColleges]);

  const openCreate = () => { setEditingId(null); setFormState(EMPTY_COLLEGE_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (college: College) => {
    setEditingId(college.id || college._id);
    setFormState({
      name: college.name, state: college.state, city: college.city, district: college.district ?? '',
      collegeType: college.collegeType, establishedYear: String(college.establishedYear ?? ''),
      aicteApproved: college.aicteApproved, bannerImage: college.bannerImage ?? '', logo: college.logo ?? '',
      description: college.description ?? '', highlights: (college.highlights ?? []).join(', '),
      naac: college.accreditation?.naac ?? '', nirfRank: String(college.accreditation?.nirfRank ?? ''),
      nbaCourses: (college.accreditation?.nbaCourses ?? []).join(', '),
      website: college.contact?.website ?? '', email: college.contact?.email ?? '',
      phone: college.contact?.phone ?? '', address: college.contact?.address ?? '',
      boysHostel: college.hostelInfo?.boysHostel ?? false, girlsHostel: college.hostelInfo?.girlsHostel ?? false,
      hostelCapacity: String(college.hostelInfo?.capacity ?? ''), messDetails: college.hostelInfo?.messDetails ?? '',
      amenities: (college.hostelInfo?.amenities ?? []).join(', '),
    });
    setFormError(null);
    setShowForm(true);
  };
  const closeForm = () => {
    setShowForm(false);
    if (searchParams.get('action')) router.replace('/admin/colleges');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      const payload: CreateCollegeInput = collegeFormToPayload(formState);
      if (editingId) await adminCollegesApi.update(adminToken, editingId, payload);
      else await adminCollegesApi.create(adminToken, payload);
      closeForm();
      loadColleges();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save college.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (college: College) => {
    if (!adminToken) return;
    if (!confirm(`Delete "${college.name}"? This cannot be undone.`)) return;
    try {
      await adminCollegesApi.remove(adminToken, college.id || college._id);
      loadColleges();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed.');
    }
  };

  const columns: AdminTableColumn<College>[] = [
    { key: 'name', label: 'College Name', sortable: true },
    { key: 'location', label: 'Location', render: c => `${c.city}, ${c.state}` },
    { key: 'collegeType', label: 'Type', render: c => <span className="admin-status-badge admin-status-info">{c.collegeType}</span> },
    { key: 'nirf', label: 'NIRF', render: c => c.accreditation?.nirfRank ? `#${c.accreditation.nirfRank}` : '—', exportValue: c => c.accreditation?.nirfRank ?? '' },
    { key: 'naac', label: 'NAAC', render: c => c.accreditation?.naac ?? '—' },
    { key: 'fee', label: 'Annual Fee', render: c => formatLakh(c.feeBreakdown?.totalAnnualFee), align: 'right' },
    { key: 'courses', label: 'Courses', render: c => c.courses?.length ?? 0, align: 'right' },
    { key: 'verified', label: 'Status', render: c => (
      <span className={`admin-status-badge ${c.isVerified ? 'admin-status-success' : 'admin-status-neutral'}`}>
        {c.isVerified ? 'Verified' : 'Unverified'}
      </span>
    ) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Colleges</h1>
          <p className="admin-page-subtitle">Full college directory — profile, accreditation, courses, fees, hostel & placements.</p>
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={colleges}
        rowKey={c => c.id || c._id}
        isLoading={isLoading}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search colleges by name, city…"
        toolbarActions={<button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ Add College</button>}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={totalResults}
        exportFilename="colleges"
        emptyMessage="No colleges match your search."
        rowActions={college => (
          <>
            <button className="admin-table-action-btn" onClick={() => setCoursesCollegeId(college.id || college._id)}>Courses</button>
            <button className="admin-table-action-btn" onClick={() => setPlacementsCollegeId(college.id || college._id)}>Placements</button>
            <button className="admin-table-action-btn" onClick={() => openEdit(college)}>Edit</button>
            <button className="admin-table-action-btn" data-danger="true" onClick={() => handleDelete(college)}>Delete</button>
          </>
        )}
      />

      {showForm && (
        <AdminModal
          title={editingId ? 'Edit College' : 'Add New College'}
          onClose={closeForm}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          error={formError}
          submitLabel={editingId ? 'Save Changes' : 'Create College'}
          wide
        >
          <CollegeFormFields state={formState} onChange={setFormState} />
        </AdminModal>
      )}

      {coursesCollegeId && (
        <CoursesManagerModal collegeId={coursesCollegeId} onClose={() => { setCoursesCollegeId(null); loadColleges(); }} />
      )}
      {placementsCollegeId && (
        <PlacementsManagerModal collegeId={placementsCollegeId} onClose={() => { setPlacementsCollegeId(null); loadColleges(); }} />
      )}
    </div>
  );
}

export default function CollegesAdminPage() {
  return (
    <Suspense fallback={<div className="admin-loading">Loading…</div>}>
      <CollegesAdminContent />
    </Suspense>
  );
}
