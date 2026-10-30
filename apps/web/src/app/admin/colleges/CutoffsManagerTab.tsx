'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCutoffsApi, type BulkCutoffRow, type CutoffStatus } from '../../../lib/admin-api';
import { collegesApi, type Course, type CutoffFacetsResult, type CutoffRow } from '../../../lib/colleges-api';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';

const EXAM_OPTIONS = ['KCET', 'COMEDK', 'NEET', 'JEE'];
const FALLBACK_CATEGORIES = ['GM'];

const STATUS_OPTIONS: Array<{ value: CutoffStatus; label: string }> = [
  { value: 'verified', label: 'Verified' },
  { value: 'needs_review', label: 'Needs Review' },
  { value: 'imported', label: 'Imported' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_BADGE_CLASS: Record<string, string> = {
  verified: 'admin-status-success',
  needs_review: 'admin-status-warning',
  imported: 'admin-status-info',
  invalid: 'admin-status-danger',
  archived: 'admin-status-neutral',
};

function statusLabel(status?: string): string {
  return STATUS_OPTIONS.find((s) => s.value === status)?.label ?? 'Verified';
}

type ModalMode = 'add' | 'edit' | 'view' | null;

interface CutoffFormState {
  examCode: string;
  courseId: string;
  year: string;
  round: string;
  category: string;
  closingRank: string;
  status: CutoffStatus;
}

const EMPTY_FORM: CutoffFormState = {
  examCode: 'KCET', courseId: '', year: String(new Date().getFullYear()), round: '1',
  category: 'GM', closingRank: '',
  status: 'verified',
};

function rowToForm(row: CutoffRow): CutoffFormState {
  return {
    examCode: row.examCode, courseId: row.courseId, year: String(row.year), round: String(row.round),
    category: row.category,
    closingRank: String(row.closingRank),
    status: (row.status as CutoffStatus) ?? 'verified',
  };
}

export function CutoffsManagerTab({ collegeId, courses }: { collegeId: string; courses: Course[] }) {
  const { adminToken } = useAdminAuth();

  const [rows, setRows] = useState<CutoffRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  const [examFilter, setExamFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [roundFilter, setRoundFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [facets, setFacets] = useState<CutoffFacetsResult | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CutoffFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const courseName = useMemo(() => {
    const map = new Map(courses.map((c) => [c.courseId, c.name]));
    return (courseId: string) => map.get(courseId) ?? courseId;
  }, [courses]);

  const load = () => {
    setIsLoading(true);
    collegesApi.getCutoffs(collegeId, {
      examCode: examFilter || undefined, year: yearFilter ? Number(yearFilter) : undefined,
      round: roundFilter ? Number(roundFilter) : undefined, category: categoryFilter || undefined,
      status: statusFilter || undefined,
      search: search || undefined, page, limit: 20,
    })
      .then((res) => { setRows(res.results); setTotal(res.total); setTotalPages(res.totalPages); })
      .catch(() => { setRows([]); setTotal(0); setTotalPages(1); })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { setPage(1); }, [examFilter, yearFilter, roundFilter, categoryFilter, statusFilter, search]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [collegeId, examFilter, yearFilter, roundFilter, categoryFilter, statusFilter, search, page]);

  useEffect(() => {
    collegesApi.getCutoffFacets(collegeId, examFilter || undefined).then(setFacets).catch(() => setFacets(null));
  }, [collegeId, examFilter]);

  // Category options are exam-driven (not data-driven), so the dropdown always offers the
  // exam's real category codes rather than only categories this college already has data for.
  const [categoryOptions, setCategoryOptions] = useState<string[]>(FALLBACK_CATEGORIES);
  useEffect(() => {
    if (!modalMode) return;
    collegesApi.getExamCategories(form.examCode).then((res) => {
      const options = res.categories.length ? res.categories : FALLBACK_CATEGORIES;
      setCategoryOptions(options);
      // Only auto-pick a default for a brand-new record — never silently rewrite an
      // existing row's category just because it predates the canonical list.
      setForm((f) => (modalMode === 'add' && !options.includes(f.category) ? { ...f, category: options[0] } : f));
    }).catch(() => setCategoryOptions(FALLBACK_CATEGORIES));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalMode, form.examCode, collegeId]);

  // Guarantee the currently-set category (even a legacy/unusual one) always appears as a
  // selectable option, so editing an older record never shows a blank/unselected dropdown.
  const effectiveCategoryOptions = categoryOptions.includes(form.category)
    ? categoryOptions
    : [form.category, ...categoryOptions];

  const openAdd = () => { setModalMode('add'); setEditingId(null); setForm(EMPTY_FORM); setFormError(null); };
  const openEdit = (row: CutoffRow) => { setModalMode('edit'); setEditingId(row.id || row._id || null); setForm(rowToForm(row)); setFormError(null); };
  const openView = (row: CutoffRow) => { setModalMode('view'); setEditingId(row.id || row._id || null); setForm(rowToForm(row)); setFormError(null); };
  const openDuplicate = (row: CutoffRow) => { setModalMode('add'); setEditingId(null); setForm(rowToForm(row)); setFormError(null); };
  const closeModal = () => { setModalMode(null); setEditingId(null); };

  const validate = (): string | null => {
    if (!form.courseId) return 'Select a course.';
    if (!form.year || !form.round) return 'Year and round are required.';
    if (!form.category.trim()) return 'Category is required.';
    if (!form.closingRank) return 'Closing rank is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const validationError = validate();
    if (validationError) { setFormError(validationError); return; }

    setIsSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'edit' && editingId) {
        await adminCutoffsApi.update(adminToken, editingId, {
          category: form.category.trim(),
          closingRank: Number(form.closingRank),
          status: form.status,
        });
      } else {
        const row: BulkCutoffRow = {
          collegeId, courseId: form.courseId, courseName: courseName(form.courseId),
          examCode: form.examCode, year: Number(form.year), round: Number(form.round),
          category: form.category.trim(),
          closingRank: Number(form.closingRank),
        };
        await adminCutoffsApi.create(adminToken, row);
      }
      closeModal();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save cutoff record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (row: CutoffRow) => {
    if (!adminToken) return;
    const id = row.id || row._id;
    if (!id) return;
    if (!confirm(`Are you sure you want to archive this cutoff record (${row.examCode} · ${courseName(row.courseId)} · ${row.category} · ${row.year} R${row.round})? It will be hidden from students and predictions but can be restored later.`)) return;
    try {
      await adminCutoffsApi.delete(adminToken, id);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Archive failed.');
    }
  };

  const handleStatusChange = async (row: CutoffRow, status: CutoffStatus) => {
    if (!adminToken) return;
    const id = row.id || row._id;
    if (!id) return;
    try {
      await adminCutoffsApi.setStatus(adminToken, id, status);
      load();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not update status.');
    }
  };

  const columns: AdminTableColumn<CutoffRow>[] = [
    { key: 'exam', label: 'Exam', render: (r) => <span className="admin-status-badge admin-status-info">{r.examCode}</span> },
    { key: 'year', label: 'Year', render: (r) => r.year, sortable: true },
    { key: 'round', label: 'Round', render: (r) => `R${r.round}` },
    { key: 'course', label: 'Course', render: (r) => courseName(r.courseId) },
    { key: 'category', label: 'Category', render: (r) => r.category },
    { key: 'closing', label: 'Closing Rank', render: (r) => <strong>{`#${r.closingRank}`}</strong>, align: 'right' },
    { key: 'source', label: 'Source', render: (r) => (
      <span className={`admin-status-badge ${r.source === 'import' ? 'admin-status-neutral' : 'admin-status-success'}`}>
        {r.source === 'import' ? 'Import' : r.source === 'official' ? 'Official' : 'Manual Entry'}
      </span>
    ) },
    { key: 'status', label: 'Status', render: (r) => (
      <span className={`admin-status-badge ${STATUS_BADGE_CLASS[r.status ?? 'verified']}`}>{statusLabel(r.status)}</span>
    ) },
    { key: 'updated', label: 'Updated', render: (r) => (r.lastUpdated ? new Date(r.lastUpdated).toLocaleDateString('en-IN') : '—') },
  ];

  const isReadOnly = modalMode === 'view';
  const isIdentityLocked = modalMode === 'edit'; // exam/course/year/round are immutable once created

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="admin-table-wrap" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', border: 'none', padding: 0 }}>
        <select className="input-editorial" style={{ width: 'auto', padding: '8px', fontSize: '13px' }} value={examFilter} onChange={(e) => setExamFilter(e.target.value)}>
          <option value="">All Exams</option>
          {EXAM_OPTIONS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
        </select>
        <select className="input-editorial" style={{ width: 'auto', padding: '8px', fontSize: '13px' }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {(facets?.years ?? []).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input-editorial" style={{ width: 'auto', padding: '8px', fontSize: '13px' }} value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)}>
          <option value="">All Rounds</option>
          {(facets?.rounds ?? []).map((r) => <option key={r} value={r}>Round {r}</option>)}
        </select>
        <select className="input-editorial" style={{ width: 'auto', padding: '8px', fontSize: '13px' }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All Categories</option>
          {(facets?.categories ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input-editorial" style={{ width: 'auto', padding: '8px', fontSize: '13px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses (excl. Archived)</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      <AdminTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id || r._id || `${r.examCode}-${r.courseId}-${r.category}-${r.year}-${r.round}`}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by course, category…"
        toolbarActions={<button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openAdd}>+ Add Cutoff</button>}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={total}
        exportFilename="cutoffs"
        emptyMessage="No cutoff records for this college yet — add one or use bulk CSV import."
        rowActions={(row) => (
          <>
            <button className="admin-table-action-btn" onClick={() => openView(row)}>View</button>
            <button className="admin-table-action-btn" onClick={() => openEdit(row)}>Edit</button>
            <button className="admin-table-action-btn" onClick={() => openDuplicate(row)}>Duplicate</button>
            {row.status === 'archived' ? (
              <button className="admin-table-action-btn" onClick={() => handleStatusChange(row, 'verified')}>Restore</button>
            ) : (
              <>
                {row.status !== 'verified' && (
                  <button className="admin-table-action-btn" onClick={() => handleStatusChange(row, 'verified')}>Verify</button>
                )}
                <button className="admin-table-action-btn" data-danger="true" onClick={() => handleArchive(row)}>Archive</button>
              </>
            )}
          </>
        )}
      />

      {modalMode && (
        <AdminModal
          title={modalMode === 'add' ? 'Add Cutoff' : modalMode === 'edit' ? 'Edit Cutoff' : 'Cutoff Details'}
          onClose={closeModal}
          onSubmit={isReadOnly ? undefined : handleSubmit}
          isSubmitting={isSubmitting}
          error={formError}
          submitLabel={modalMode === 'edit' ? 'Save Changes' : 'Create Cutoff'}
          wide
        >
          <div className="admin-form-grid">
            <div className="admin-form-group">
              <label className="admin-form-label">Exam</label>
              <select className="input-editorial" disabled={isReadOnly || isIdentityLocked} value={form.examCode} onChange={(e) => setForm({ ...form, examCode: e.target.value })}>
                {EXAM_OPTIONS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Course</label>
              <select className="input-editorial" required disabled={isReadOnly || isIdentityLocked} value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                <option value="">Select course…</option>
                {courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.name} ({c.courseId})</option>)}
              </select>
              {courses.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No courses on this college yet — add one first.</span>}
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Academic Year</label>
              <input type="number" className="input-editorial" required disabled={isReadOnly || isIdentityLocked} value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Round</label>
              <input type="number" min={1} className="input-editorial" required disabled={isReadOnly || isIdentityLocked} value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} />
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Category</label>
              <select
                className="input-editorial" required disabled={isReadOnly}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {effectiveCategoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label className="admin-form-label">Closing Rank</label>
              <input type="number" min={1} className="input-editorial" required disabled={isReadOnly} value={form.closingRank} onChange={(e) => setForm({ ...form, closingRank: e.target.value })} />
            </div>
            {modalMode === 'edit' && (
              <div className="admin-form-group">
                <label className="admin-form-label">Data Quality Status</label>
                <select className="input-editorial" disabled={isReadOnly} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CutoffStatus })}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            )}
          </div>
        </AdminModal>
      )}
    </div>
  );
}
