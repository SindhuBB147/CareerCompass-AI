'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCollegesApi, type CreateCollegeInput } from '../../../lib/admin-api';
import type { College } from '../../../lib/colleges-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';
import { ReauthModal } from '../../../components/admin/ReauthModal';
import { CollegeFormFields, EMPTY_COLLEGE_FORM, type CollegeFormState, collegeFormToPayload, collegeToFormState } from './CollegeFormFields';
import { CoursesManagerModal } from './CoursesManagerModal';
import { PlacementsManagerModal } from './PlacementsManagerModal';
import { ImagesManagerModal } from './ImagesManagerModal';

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
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [formState, setFormState] = useState<CollegeFormState>(EMPTY_COLLEGE_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(searchParams.get('action') === 'new');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [coursesCollegeId, setCoursesCollegeId] = useState<string | null>(null);
  const [placementsCollegeId, setPlacementsCollegeId] = useState<string | null>(null);
  const [imagesCollegeId, setImagesCollegeId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  const handleImportImages = async () => {
    if (!adminToken) return;
    setIsImporting(true);
    setImportResult(null);
    try {
      const res = await adminCollegesApi.importImages(adminToken);
      setImportResult(`Processed ${res.totalProcessed} · updated ${res.updatedCount} · already had images ${res.skippedCount} · not found ${res.missingCount}`);
      loadColleges();
    } catch (err) {
      setImportResult(err instanceof ApiError ? err.message : 'Image import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const loadColleges = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminCollegesApi.search(adminToken, {
      q: debouncedSearch || undefined, discipline: disciplineFilter || undefined,
      includeArchived: showArchived || undefined, page: showArchived ? 1 : page, limit: showArchived ? 100 : 15,
    })
      .then(res => {
        // Backend only supports "active" (default) or "active+archived"
        // (includeArchived) — the archived-only view filters that combined
        // result client-side rather than adding a third server-side mode.
        const results = showArchived ? res.results.filter(c => c.status === 'archived') : res.results;
        setColleges(results);
        setTotalResults(showArchived ? results.length : res.totalResults);
        setTotalPages(showArchived ? 1 : res.totalPages);
      })
      .catch(() => { setColleges([]); setTotalResults(0); setTotalPages(1); })
      .finally(() => setIsLoading(false));
  }, [adminToken, debouncedSearch, page, disciplineFilter, showArchived]);

  useEffect(() => { setPage(1); }, [debouncedSearch, disciplineFilter, showArchived]);
  useEffect(() => { loadColleges(); }, [loadColleges]);

  const openCreate = () => { setEditingId(null); setFormState(EMPTY_COLLEGE_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (college: College) => {
    setEditingId(college.id || college._id);
    setFormState(collegeToFormState(college));
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

  const [reauthTarget, setReauthTarget] = useState<College | null>(null);

  const handleArchive = async (college: College, reauthToken?: string) => {
    if (!adminToken) return;
    if (!reauthToken && !confirm(`Archive "${college.name}"? It will disappear from search and the public site, but its courses, seats, cutoffs, fees and images stay attached and it can be restored later.`)) return;
    try {
      await adminCollegesApi.archive(adminToken, college.id || college._id, reauthToken);
      setReauthTarget(null);
      loadColleges();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'REAUTH_REQUIRED') { setReauthTarget(college); return; }
      alert(err instanceof ApiError ? err.message : 'Archive failed.');
    }
  };

  const handleRestore = async (college: College) => {
    if (!adminToken) return;
    try {
      await adminCollegesApi.restore(adminToken, college.id || college._id);
      loadColleges();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Restore failed.');
    }
  };

  const columns: AdminTableColumn<College>[] = [
    { key: 'collegeId', label: 'College ID', render: c => c.collegeId || '—' },
    { key: 'name', label: 'College Name', sortable: true, render: c => (
      <Link href={`/admin/colleges/${c.id || c._id}`} style={{ color: 'var(--accent-blue, inherit)', fontWeight: 600 }}>{c.name}</Link>
    ) },
    { key: 'location', label: 'Location', render: c => `${c.city}, ${c.state}` },
    { key: 'collegeType', label: 'Type', render: c => <span className="admin-status-badge admin-status-info">{c.collegeType}</span> },
    { key: 'nirf', label: 'NIRF', render: c => c.accreditation?.nirfRank ? `#${c.accreditation.nirfRank}` : '—', exportValue: c => c.accreditation?.nirfRank ?? '' },
    { key: 'naac', label: 'NAAC', render: c => c.accreditation?.naac ?? '—' },
    { key: 'fee', label: 'Annual Fee', render: c => formatLakh(c.feeBreakdown?.totalAnnualFee), align: 'right' },
    { key: 'courses', label: 'Courses', render: c => c.courses?.length ?? 0, align: 'right' },
    { key: 'completeness', label: 'Data', render: c => {
      let score = 0;
      if (c.courses && c.courses.length > 0) score++;
      if (c.contact?.website || c.contact?.phone) score++;
      if (c.feeBreakdown?.totalAnnualFee && c.feeBreakdown.totalAnnualFee > 0) score++;
      if (c.about?.summary) score++;
      if (c.admissionRoutes && c.admissionRoutes.length > 0) score++;
      const colorClass = score === 5 ? 'admin-status-success' : score >= 3 ? 'admin-status-info' : 'admin-status-neutral';
      return <span className={`admin-status-badge ${colorClass}`}>{score}/5</span>;
    } },
    { key: 'verified', label: 'Status', render: c => (
      <span className={`admin-status-badge ${c.isVerified ? 'admin-status-success' : 'admin-status-neutral'}`}>
        {c.isVerified ? 'Verified' : 'Unverified'}
      </span>
    ) },
    { key: 'images', label: 'Images', render: c => {
      const gallery = c.gallery ?? [];
      const verifiedCount = gallery.filter(g => !g.verificationStatus || g.verificationStatus === 'verified').length;
      const needsReviewCount = gallery.filter(g => g.verificationStatus === 'needs_review').length;
      if (c.bannerImage && verifiedCount > 0) return <span className="admin-status-badge admin-status-success">✓ {verifiedCount} Verified</span>;
      if (needsReviewCount > 0) return <span className="admin-status-badge admin-status-warning">⚠ {needsReviewCount} Needs Review</span>;
      return <span className="admin-status-badge admin-status-neutral">Missing</span>;
    } },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="font-serif admin-page-title">Colleges</h1>
          <p className="admin-page-subtitle">Full college directory — profile, accreditation, courses, fees, hostel & placements.</p>
        </div>
      </div>

      {importResult && <div className="admin-inline-message" style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)' }}>{importResult}</div>}

      <AdminTable
        columns={columns}
        rows={colleges}
        rowKey={c => c.id || c._id}
        isLoading={isLoading}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search colleges by name, city…"
        toolbarActions={
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <select
              className="input-editorial"
              style={{ padding: '8px', fontSize: '13px', width: 'auto' }}
              value={disciplineFilter}
              onChange={e => setDisciplineFilter(e.target.value)}
            >
              <option value="">All Disciplines</option>
              <option value="Engineering">Engineering</option>
              <option value="Medical">Medical</option>
              <option value="Dental">Dental</option>
              <option value="Nursing">Nursing</option>
              <option value="Pharmacy">Pharmacy</option>
              <option value="Architecture">Architecture</option>
              <option value="Agriculture">Agriculture</option>
              <option value="Veterinary">Veterinary</option>
            </select>
            <button
              className={showArchived ? 'btn-editorial-primary' : 'btn-editorial-secondary'}
              style={{ padding: '9px 18px', fontSize: '13px' }}
              onClick={() => setShowArchived(v => !v)}
            >
              {showArchived ? '✓ Showing Archived' : 'Show Archived'}
            </button>
            <button className="btn-editorial-secondary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={handleImportImages} disabled={isImporting} title="Load researched images (data/college-images.json) into colleges that don't have any yet">
              {isImporting ? 'Syncing…' : '🖼️ Sync Researched Images'}
            </button>
            <button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ Add College</button>
          </div>
        }
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={totalResults}
        exportFilename="colleges"
        emptyMessage={showArchived ? 'No archived colleges.' : (debouncedSearch || disciplineFilter ? 'No colleges match your filters.' : 'No colleges found. Add one to get started.')}
        rowActions={college => showArchived ? (
          <>
            <Link className="admin-table-action-btn" href={`/admin/colleges/${college.id || college._id}`}>View</Link>
            <button className="admin-table-action-btn" onClick={() => handleRestore(college)}>Restore</button>
          </>
        ) : (
          <>
            <Link className="admin-table-action-btn" href={`/admin/colleges/${college.id || college._id}`}>View</Link>
            <button className="admin-table-action-btn" onClick={() => setCoursesCollegeId(college.id || college._id)}>Courses</button>
            <button className="admin-table-action-btn" onClick={() => setPlacementsCollegeId(college.id || college._id)}>Placements</button>
            <button className="admin-table-action-btn" onClick={() => setImagesCollegeId(college.id || college._id)}>Images</button>
            <button className="admin-table-action-btn" onClick={() => openEdit(college)}>Edit</button>
            <button className="admin-table-action-btn" data-danger="true" onClick={() => handleArchive(college)}>Archive</button>
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
      {imagesCollegeId && (
        <ImagesManagerModal collegeId={imagesCollegeId} onClose={() => { setImagesCollegeId(null); loadColleges(); }} />
      )}
      {reauthTarget && (
        <ReauthModal
          actionLabel={`Archive "${reauthTarget.name}"`}
          onCancel={() => setReauthTarget(null)}
          onConfirm={(reauthToken) => handleArchive(reauthTarget, reauthToken)}
        />
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
