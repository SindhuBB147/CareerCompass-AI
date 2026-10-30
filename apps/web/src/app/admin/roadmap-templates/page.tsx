'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminRoadmapTemplatesApi, type CareerTemplateInput, type CareerTemplateRecord } from '../../../lib/admin-api';
import { CAREER_CATEGORY_LABELS, type CareerCategory } from '../../../lib/roadmap-api';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';

const CATEGORIES = Object.keys(CAREER_CATEGORY_LABELS) as CareerCategory[];

interface FormState {
  careerId: string;
  name: string;
  category: CareerCategory;
  description: string;
  tags: string;
  phasesJson: string;
  isActive: boolean;
}

function toForm(t?: CareerTemplateRecord): FormState {
  return {
    careerId: t?.careerId ?? '',
    name: t?.name ?? '',
    category: (t?.category ?? 'engineering_tech') as CareerCategory,
    description: t?.description ?? '',
    tags: (t?.tags ?? []).join(', '),
    phasesJson: JSON.stringify(t?.phases ?? [], null, 2),
    isActive: t?.isActive ?? true,
  };
}

export default function RoadmapTemplatesAdminPage() {
  const { adminToken } = useAdminAuth();
  const [templates, setTemplates] = useState<CareerTemplateRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalTemplate, setModalTemplate] = useState<CareerTemplateRecord | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(toForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!adminToken) return;
    setLoading(true);
    adminRoadmapTemplatesApi.list(adminToken, 1, 50)
      .then(res => { setTemplates(res.templates); setTotal(res.total); })
      .finally(() => setLoading(false));
  }, [adminToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(toForm()); setFormError(null); setModalTemplate('new'); };
  const openEdit = (t: CareerTemplateRecord) => { setForm(toForm(t)); setFormError(null); setModalTemplate(t); };
  const closeModal = () => setModalTemplate(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setFormError(null);

    let phases: unknown[];
    try {
      phases = JSON.parse(form.phasesJson);
      if (!Array.isArray(phases)) throw new Error('Phases must be a JSON array.');
    } catch (err) {
      setFormError(`Invalid phases JSON: ${err instanceof Error ? err.message : 'parse error'}`);
      return;
    }

    const dto: CareerTemplateInput = {
      careerId: form.careerId.trim(),
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      phases,
      isActive: form.isActive,
    };

    setSubmitting(true);
    try {
      if (modalTemplate === 'new') await adminRoadmapTemplatesApi.create(adminToken, dto);
      else await adminRoadmapTemplatesApi.update(adminToken, dto.careerId, dto);
      closeModal();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save this template.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t: CareerTemplateRecord) => {
    if (!adminToken || !confirm(`Delete the "${t.name}" roadmap template? This does not affect students who already have this roadmap generated.`)) return;
    await adminRoadmapTemplatesApi.remove(adminToken, t.careerId);
    load();
  };

  const filtered = templates.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.careerId.includes(search.toLowerCase()));

  const columns: AdminTableColumn<CareerTemplateRecord>[] = [
    { key: 'name', label: 'Career', sortable: true },
    { key: 'category', label: 'Category', render: t => CAREER_CATEGORY_LABELS[t.category] ?? t.category, sortable: true },
    { key: 'phases', label: 'Phases', render: t => String(t.phases.length), align: 'center' },
    { key: 'milestones', label: 'Milestones', render: t => String((t.phases as any[]).reduce((sum, p) => sum + (p.milestones?.length ?? 0), 0)), align: 'center' },
    { key: 'isActive', label: 'Active', render: t => (t.isActive ? '✅' : '—'), align: 'center' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Career Roadmap Templates</h1>
          <p className="admin-page-subtitle">The catalog of career paths the Roadmap module personalizes for students — phases, milestones, skills, certifications, projects, and resources.</p>
        </div>
      </div>

      <AdminTable
        columns={columns}
        rows={filtered}
        rowKey={t => t.careerId}
        isLoading={loading}
        emptyMessage="No career templates found."
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or career id..."
        totalCount={total}
        toolbarActions={<button type="button" className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ New Template</button>}
        rowActions={t => (
          <>
            <button type="button" className="admin-table-action-btn" onClick={() => openEdit(t)}>Edit</button>
            <button type="button" className="admin-table-action-btn" data-danger onClick={() => handleDelete(t)}>Delete</button>
          </>
        )}
      />

      {modalTemplate && (
        <AdminModal
          title={modalTemplate === 'new' ? 'New Career Roadmap Template' : `Edit: ${form.name}`}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSubmitting={submitting}
          error={formError}
          wide
        >
          <div className="admin-form-grid">
            <div className="admin-form-group">
              <span className="admin-form-label">Career ID (slug)</span>
              <input
                className="input-editorial" required disabled={modalTemplate !== 'new'}
                value={form.careerId} onChange={e => setForm(f => ({ ...f, careerId: e.target.value }))}
                placeholder="e.g. software-engineer"
              />
            </div>
            <div className="admin-form-group">
              <span className="admin-form-label">Name</span>
              <input className="input-editorial" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="admin-form-group">
              <span className="admin-form-label">Category</span>
              <select className="input-editorial" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as CareerCategory }))}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CAREER_CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <span className="admin-form-label">Tags (comma-separated)</span>
              <input className="input-editorial" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>
            <div className="admin-form-group" data-span="2">
              <span className="admin-form-label">Description</span>
              <textarea className="input-editorial" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ minHeight: '70px' }} />
            </div>
            <div className="admin-form-group" data-span="2" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
              <span className="admin-form-label">Active (visible to students)</span>
            </div>
            <div className="admin-form-group" data-span="2">
              <span className="admin-form-label">Phases (JSON) — array of {'{ phaseKey, label, order, milestones: [...] }'}</span>
              <textarea
                className="input-editorial" value={form.phasesJson} onChange={e => setForm(f => ({ ...f, phasesJson: e.target.value }))}
                style={{ minHeight: '320px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '13px' }}
              />
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
