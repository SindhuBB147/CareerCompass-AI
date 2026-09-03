'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import {
  adminScholarshipsApi, adminScholarshipCategoriesApi, adminScholarshipProvidersApi,
  type Scholarship, type CreateScholarshipInput, type CreateCategoryInput, type CreateProviderInput,
} from '../../../lib/admin-api';
import type { ScholarshipCategory, ScholarshipProvider } from '../../../lib/scholarships-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { AdminTable, type AdminTableColumn } from '../../../components/admin/AdminTable';
import { AdminModal } from '../../../components/admin/AdminModal';

type Tab = 'scholarships' | 'categories' | 'providers';

function ScholarshipsAdminContent() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('scholarships');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="admin-page-header">
        <div>
          <h1 className="font-serif admin-page-title">Scholarships</h1>
          <p className="admin-page-subtitle">Eligibility rules, documents, application process, links, and deadlines.</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button type="button" className="admin-tab" data-active={tab === 'scholarships'} onClick={() => setTab('scholarships')}>Scholarships</button>
        <button type="button" className="admin-tab" data-active={tab === 'categories'} onClick={() => setTab('categories')}>Categories</button>
        <button type="button" className="admin-tab" data-active={tab === 'providers'} onClick={() => setTab('providers')}>Providers</button>
      </div>

      {tab === 'scholarships' && <ScholarshipsTab initialAction={searchParams.get('action')} />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'providers' && <ProvidersTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Scholarships tab
// ═══════════════════════════════════════════════════════════════════════════

interface FormState {
  name: string; provider: 'government' | 'private' | 'institution'; providerName: string; type: string; description: string;
  categories: string[];
  eligCategories: string; maxIncome: string; minIncome: string; states: string; exams: string[];
  applicableCourses: string; genderSpecific: string; minorityOnly: boolean; pwdOnly: boolean;
  requiredReservations: string; minRank: string; maxRank: string; minAcademicPercent: string; academicCriteriaNote: string;
  awardType: 'fixed' | 'percentage'; awardValue: string; awardDisplayText: string;
  documents: string; applicationStepsText: string; applicationMode: 'online' | 'offline' | 'both';
  faqsText: string;
  officialWebsite: string; applyLink: string; notificationPdf: string; guidelinesPdf: string; helpdeskUrl: string;
  contactEmail: string; contactPhone: string;
  applicationOpensAt: string; applicationDeadline: string; renewalPolicy: string;
  featured: boolean; isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '', provider: 'government', providerName: '', type: '', description: '',
  categories: [],
  eligCategories: '', maxIncome: '', minIncome: '', states: 'Karnataka', exams: ['KCET'],
  applicableCourses: '', genderSpecific: '', minorityOnly: false, pwdOnly: false,
  requiredReservations: '', minRank: '', maxRank: '', minAcademicPercent: '', academicCriteriaNote: '',
  awardType: 'fixed', awardValue: '', awardDisplayText: '',
  documents: '', applicationStepsText: '', applicationMode: 'online',
  faqsText: '',
  officialWebsite: '', applyLink: '', notificationPdf: '', guidelinesPdf: '', helpdeskUrl: '',
  contactEmail: '', contactPhone: '',
  applicationOpensAt: '', applicationDeadline: '', renewalPolicy: '',
  featured: false, isActive: true,
};

const csv = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean);

/** "Title: Description" per line -> ApplicationStep[] */
function parseSteps(text: string): CreateScholarshipInput['applicationSteps'] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => {
    const [title, ...rest] = line.split(':');
    return { stepNumber: idx + 1, title: title.trim(), description: rest.join(':').trim() || title.trim() };
  });
}

/** "Question? | Answer." per line -> Faq[] */
function parseFaqs(text: string): CreateScholarshipInput['faqs'] {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const [question, ...rest] = line.split('|');
    return { question: question.trim(), answer: rest.join('|').trim() };
  });
}

function stepsToText(steps: Scholarship['applicationSteps']): string {
  return (steps ?? []).map(s => `${s.title}: ${s.description}`).join('\n');
}
function faqsToText(faqs: Scholarship['faqs']): string {
  return (faqs ?? []).map(f => `${f.question} | ${f.answer}`).join('\n');
}

function formToPayload(f: FormState): CreateScholarshipInput {
  return {
    name: f.name, provider: f.provider, providerName: f.providerName || undefined, type: f.type || undefined,
    description: f.description || undefined,
    categories: f.categories,
    eligibility: {
      categories: csv(f.eligCategories),
      maxIncome: f.maxIncome ? Number(f.maxIncome) : undefined,
      minIncome: f.minIncome ? Number(f.minIncome) : undefined,
      states: csv(f.states),
      exams: f.exams,
      applicableCourses: csv(f.applicableCourses),
      genderSpecific: f.genderSpecific || undefined,
      minorityOnly: f.minorityOnly,
      pwdOnly: f.pwdOnly,
      requiredReservations: csv(f.requiredReservations),
      minRank: f.minRank ? Number(f.minRank) : undefined,
      maxRank: f.maxRank ? Number(f.maxRank) : undefined,
      minAcademicPercent: f.minAcademicPercent ? Number(f.minAcademicPercent) : undefined,
      academicCriteriaNote: f.academicCriteriaNote || undefined,
    },
    awardAmount: { type: f.awardType, value: Number(f.awardValue), displayText: f.awardDisplayText || undefined },
    documents: csv(f.documents.replace(/\n/g, ',')),
    applicationSteps: parseSteps(f.applicationStepsText),
    applicationMode: f.applicationMode,
    faqs: parseFaqs(f.faqsText),
    links: {
      officialWebsite: f.officialWebsite || undefined, applyLink: f.applyLink || undefined,
      notificationPdf: f.notificationPdf || undefined, guidelinesPdf: f.guidelinesPdf || undefined, helpdeskUrl: f.helpdeskUrl || undefined,
    },
    contact: { email: f.contactEmail || undefined, phone: f.contactPhone || undefined },
    applicationOpensAt: f.applicationOpensAt || undefined,
    applicationDeadline: f.applicationDeadline,
    renewalPolicy: f.renewalPolicy || undefined,
    featured: f.featured,
  };
}

function ScholarshipsTab({ initialAction }: { initialAction: string | null }) {
  const { adminToken } = useAdminAuth();
  const router = useRouter();

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedValue(searchTerm, 350);

  const [showForm, setShowForm] = useState(initialAction === 'new');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminScholarshipsApi.list(adminToken, { q: debouncedSearch || undefined, page, limit: 15 })
      .then(res => { setScholarships(res.scholarships); setTotalResults(res.totalResults); setTotalPages(Math.max(1, Math.ceil(res.totalResults / 15))); })
      .catch(() => { setScholarships([]); setTotalResults(0); })
      .finally(() => setIsLoading(false));
  }, [adminToken, debouncedSearch, page]);

  useEffect(() => { setPage(1); }, [debouncedSearch]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!adminToken) return;
    adminScholarshipCategoriesApi.list(adminToken).then(setCategories).catch(() => setCategories([]));
  }, [adminToken]);

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setFormError(null); setShowForm(true); };
  const openEdit = (s: Scholarship) => {
    setEditingId(s.id || s._id);
    setForm({
      name: s.name, provider: s.provider, providerName: s.providerName ?? '', type: s.type ?? '', description: s.description ?? '',
      categories: s.categories ?? [],
      eligCategories: (s.eligibility.categories ?? []).join(', '), maxIncome: String(s.eligibility.maxIncome ?? ''), minIncome: String(s.eligibility.minIncome ?? ''),
      states: (s.eligibility.states ?? []).join(', '), exams: s.eligibility.exams ?? [],
      applicableCourses: (s.eligibility.applicableCourses ?? []).join(', '), genderSpecific: s.eligibility.genderSpecific ?? '',
      minorityOnly: !!s.eligibility.minorityOnly, pwdOnly: !!s.eligibility.pwdOnly,
      requiredReservations: (s.eligibility.requiredReservations ?? []).join(', '),
      minRank: String(s.eligibility.minRank ?? ''), maxRank: String(s.eligibility.maxRank ?? ''),
      minAcademicPercent: String(s.eligibility.minAcademicPercent ?? ''), academicCriteriaNote: s.eligibility.academicCriteriaNote ?? '',
      awardType: s.awardAmount.type, awardValue: String(s.awardAmount.value), awardDisplayText: s.awardAmount.displayText ?? '',
      documents: (s.documents ?? []).join(', '), applicationStepsText: stepsToText(s.applicationSteps), applicationMode: s.applicationMode ?? 'online',
      faqsText: faqsToText(s.faqs),
      officialWebsite: s.links?.officialWebsite ?? '', applyLink: s.links?.applyLink ?? '', notificationPdf: s.links?.notificationPdf ?? '',
      guidelinesPdf: s.links?.guidelinesPdf ?? '', helpdeskUrl: s.links?.helpdeskUrl ?? '',
      contactEmail: s.contact?.email ?? '', contactPhone: s.contact?.phone ?? '',
      applicationOpensAt: s.applicationOpensAt?.slice(0, 10) ?? '', applicationDeadline: s.applicationDeadline.slice(0, 10), renewalPolicy: s.renewalPolicy ?? '',
      featured: s.featured, isActive: s.isActive,
    });
    setFormError(null);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); if (initialAction) router.replace('/admin/scholarships'); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSubmitting(true);
    setFormError(null);
    try {
      if (editingId) await adminScholarshipsApi.update(adminToken, editingId, { ...formToPayload(form), isActive: form.isActive });
      else await adminScholarshipsApi.create(adminToken, formToPayload(form));
      closeForm();
      load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save scholarship.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (s: Scholarship) => {
    if (!adminToken || !confirm(`Delete "${s.name}"?`)) return;
    try { await adminScholarshipsApi.remove(adminToken, s.id || s._id); load(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'Delete failed.'); }
  };

  const handleNotifyDeadline = async (s: Scholarship) => {
    if (!adminToken) return;
    try {
      const res = await adminScholarshipsApi.notifyDeadline(adminToken, s.id || s._id);
      alert(`Notified ${res.notified} student(s) about this scholarship's deadline.`);
    } catch (err) { alert(err instanceof ApiError ? err.message : 'Could not send notifications.'); }
  };

  const toggleExam = (exam: string) => {
    setForm(prev => ({ ...prev, exams: prev.exams.includes(exam) ? prev.exams.filter(e => e !== exam) : [...prev.exams, exam] }));
  };
  const toggleCategory = (slug: string) => {
    setForm(prev => ({ ...prev, categories: prev.categories.includes(slug) ? prev.categories.filter(c => c !== slug) : [...prev.categories, slug] }));
  };

  const columns: AdminTableColumn<Scholarship>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'provider', label: 'Provider', render: s => <span className="admin-status-badge admin-status-info">{s.provider}</span> },
    { key: 'amount', label: 'Award', render: s => s.awardAmount.type === 'fixed' ? `₹${s.awardAmount.value.toLocaleString('en-IN')}` : `${s.awardAmount.value}%` },
    { key: 'exams', label: 'Exams', render: s => (s.eligibility.exams ?? []).join(', ') || 'Any' },
    { key: 'deadline', label: 'Deadline', render: s => new Date(s.applicationDeadline).toLocaleDateString() },
    { key: 'featured', label: 'Featured', render: s => s.featured ? '⭐' : '—' },
    { key: 'status', label: 'Status', render: s => (
      <span className={`admin-status-badge ${s.isActive ? 'admin-status-success' : 'admin-status-neutral'}`}>{s.isActive ? 'Active' : 'Inactive'}</span>
    ) },
  ];

  return (
    <>
      <AdminTable
        columns={columns}
        rows={scholarships}
        rowKey={s => s.id || s._id}
        isLoading={isLoading}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search scholarships…"
        toolbarActions={<button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ Add Scholarship</button>}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        totalCount={totalResults}
        exportFilename="scholarships"
        rowActions={s => (
          <>
            <button className="admin-table-action-btn" onClick={() => openEdit(s)}>Edit</button>
            <button className="admin-table-action-btn" onClick={() => handleNotifyDeadline(s)}>Notify</button>
            <button className="admin-table-action-btn" data-danger="true" onClick={() => handleDelete(s)}>Delete</button>
          </>
        )}
      />

      {showForm && (
        <AdminModal title={editingId ? 'Edit Scholarship' : 'Add Scholarship'} onClose={closeForm} onSubmit={handleSubmit} isSubmitting={isSubmitting} error={formError} submitLabel={editingId ? 'Save Changes' : 'Create Scholarship'} wide>
          <div className="admin-form-grid">
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Scholarship Name</label>
              <input className="input-editorial" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>

            <div className="admin-form-group"><label className="admin-form-label">Provider Type</label>
              <select className="input-editorial" value={form.provider} onChange={e => setForm({ ...form, provider: e.target.value as FormState['provider'] })}>
                <option value="government">Government</option><option value="private">Private</option><option value="institution">Institution</option>
              </select></div>
            <div className="admin-form-group"><label className="admin-form-label">Provider Name (display)</label>
              <input className="input-editorial" value={form.providerName} onChange={e => setForm({ ...form, providerName: e.target.value })} placeholder="e.g. AICTE" /></div>

            <div className="admin-form-group"><label className="admin-form-label">Scholarship Type</label>
              <input className="input-editorial" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} placeholder="merit, means, sports…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Application Mode</label>
              <select className="input-editorial" value={form.applicationMode} onChange={e => setForm({ ...form, applicationMode: e.target.value as FormState['applicationMode'] })}>
                <option value="online">Online</option><option value="offline">Offline</option><option value="both">Both</option>
              </select></div>

            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Description</label>
              <textarea className="input-editorial" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} /></div>

            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Categories</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                {categories.map(c => (
                  <label key={c.slug} className="admin-checkbox-row">
                    <input type="checkbox" className="admin-checkbox" checked={form.categories.includes(c.slug)} onChange={() => toggleCategory(c.slug)} />
                    {c.icon} {c.name}
                  </label>
                ))}
              </div></div>

            <div className="admin-form-group" data-span="2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
              <label className="admin-form-label" style={{ fontSize: '14px' }}>Eligibility Rules</label>
            </div>
            <div className="admin-form-group"><label className="admin-form-label">Eligible Categories (comma-separated)</label>
              <input className="input-editorial" value={form.eligCategories} onChange={e => setForm({ ...form, eligCategories: e.target.value })} placeholder="GM, SC, ST, EWS, General" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Eligible States (comma-separated)</label>
              <input className="input-editorial" value={form.states} onChange={e => setForm({ ...form, states: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Max Family Income (₹)</label>
              <input type="number" className="input-editorial" value={form.maxIncome} onChange={e => setForm({ ...form, maxIncome: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Min Family Income (₹)</label>
              <input type="number" className="input-editorial" value={form.minIncome} onChange={e => setForm({ ...form, minIncome: e.target.value })} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Applicable Exams</label>
              <div style={{ display: 'flex', gap: '14px' }}>
                {['KCET', 'COMEDK', 'NEET'].map(exam => (
                  <label key={exam} className="admin-checkbox-row"><input type="checkbox" className="admin-checkbox" checked={form.exams.includes(exam)} onChange={() => toggleExam(exam)} />{exam}</label>
                ))}
              </div></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Applicable Courses (comma-separated)</label>
              <input className="input-editorial" value={form.applicableCourses} onChange={e => setForm({ ...form, applicableCourses: e.target.value })} placeholder="MBBS, B.E./B.Tech, Diploma" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Gender Restriction</label>
              <select className="input-editorial" value={form.genderSpecific} onChange={e => setForm({ ...form, genderSpecific: e.target.value })}>
                <option value="">Any</option><option value="female">Female Only</option><option value="male">Male Only</option>
              </select></div>
            <div className="admin-form-group"><label className="admin-form-label">Minimum Academic %</label>
              <input type="number" className="input-editorial" value={form.minAcademicPercent} onChange={e => setForm({ ...form, minAcademicPercent: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Min Rank</label>
              <input type="number" className="input-editorial" value={form.minRank} onChange={e => setForm({ ...form, minRank: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Max Rank</label>
              <input type="number" className="input-editorial" value={form.maxRank} onChange={e => setForm({ ...form, maxRank: e.target.value })} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Required Reservations (comma-separated)</label>
              <input className="input-editorial" value={form.requiredReservations} onChange={e => setForm({ ...form, requiredReservations: e.target.value })} placeholder="Sports, Defence, Rural" /></div>
            <div className="admin-form-group"><label className="admin-checkbox-row"><input type="checkbox" className="admin-checkbox" checked={form.minorityOnly} onChange={e => setForm({ ...form, minorityOnly: e.target.checked })} />Minority students only</label></div>
            <div className="admin-form-group"><label className="admin-checkbox-row"><input type="checkbox" className="admin-checkbox" checked={form.pwdOnly} onChange={e => setForm({ ...form, pwdOnly: e.target.checked })} />PwD students only</label></div>

            <div className="admin-form-group" data-span="2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
              <label className="admin-form-label" style={{ fontSize: '14px' }}>Award &amp; Dates</label>
            </div>
            <div className="admin-form-group"><label className="admin-form-label">Award Type</label>
              <select className="input-editorial" value={form.awardType} onChange={e => setForm({ ...form, awardType: e.target.value as FormState['awardType'] })}>
                <option value="fixed">Fixed Amount (₹)</option><option value="percentage">Fee Percentage (%)</option>
              </select></div>
            <div className="admin-form-group"><label className="admin-form-label">Award Value</label>
              <input type="number" className="input-editorial" required value={form.awardValue} onChange={e => setForm({ ...form, awardValue: e.target.value })} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Display Text (optional, overrides above)</label>
              <input className="input-editorial" value={form.awardDisplayText} onChange={e => setForm({ ...form, awardDisplayText: e.target.value })} placeholder="e.g. Up to ₹50,000/year" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Opens On</label>
              <input type="date" className="input-editorial" value={form.applicationOpensAt} onChange={e => setForm({ ...form, applicationOpensAt: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Deadline</label>
              <input type="date" className="input-editorial" required value={form.applicationDeadline} onChange={e => setForm({ ...form, applicationDeadline: e.target.value })} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Renewal Policy</label>
              <input className="input-editorial" value={form.renewalPolicy} onChange={e => setForm({ ...form, renewalPolicy: e.target.value })} placeholder="Renewable annually with 50%+ marks" /></div>

            <div className="admin-form-group" data-span="2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
              <label className="admin-form-label" style={{ fontSize: '14px' }}>Documents, Steps &amp; FAQs</label>
            </div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Documents Required (comma-separated)</label>
              <textarea className="input-editorial" rows={2} value={form.documents} onChange={e => setForm({ ...form, documents: e.target.value })} placeholder="Aadhaar Card, Income Certificate, Marks Cards…" style={{ resize: 'vertical' }} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Application Steps — one per line as "Title: Description"</label>
              <textarea className="input-editorial" rows={4} value={form.applicationStepsText} onChange={e => setForm({ ...form, applicationStepsText: e.target.value })} placeholder={'Check Eligibility: Review criteria below\nCollect Documents: Gather required documents'} style={{ resize: 'vertical' }} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">FAQs — one per line as "Question? | Answer."</label>
              <textarea className="input-editorial" rows={3} value={form.faqsText} onChange={e => setForm({ ...form, faqsText: e.target.value })} placeholder={'Is this renewable? | Yes, subject to minimum marks each year.'} style={{ resize: 'vertical' }} /></div>

            <div className="admin-form-group" data-span="2" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', marginTop: '4px' }}>
              <label className="admin-form-label" style={{ fontSize: '14px' }}>Official Links &amp; Contact</label>
            </div>
            <div className="admin-form-group"><label className="admin-form-label">Official Website</label>
              <input className="input-editorial" value={form.officialWebsite} onChange={e => setForm({ ...form, officialWebsite: e.target.value })} placeholder="https://…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Apply Link</label>
              <input className="input-editorial" value={form.applyLink} onChange={e => setForm({ ...form, applyLink: e.target.value })} placeholder="https://…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Official Notification PDF</label>
              <input className="input-editorial" value={form.notificationPdf} onChange={e => setForm({ ...form, notificationPdf: e.target.value })} placeholder="https://…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Guidelines PDF</label>
              <input className="input-editorial" value={form.guidelinesPdf} onChange={e => setForm({ ...form, guidelinesPdf: e.target.value })} placeholder="https://…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Helpdesk URL</label>
              <input className="input-editorial" value={form.helpdeskUrl} onChange={e => setForm({ ...form, helpdeskUrl: e.target.value })} placeholder="https://…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Contact Email</label>
              <input className="input-editorial" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Contact Phone</label>
              <input className="input-editorial" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>

            <div className="admin-form-group"><label className="admin-checkbox-row"><input type="checkbox" className="admin-checkbox" checked={form.featured} onChange={e => setForm({ ...form, featured: e.target.checked })} />Featured</label></div>
            {editingId && (
              <div className="admin-form-group"><label className="admin-checkbox-row"><input type="checkbox" className="admin-checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />Active (visible to students)</label></div>
            )}
          </div>
        </AdminModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Categories tab
// ═══════════════════════════════════════════════════════════════════════════

function CategoriesTab() {
  const { adminToken } = useAdminAuth();
  const [categories, setCategories] = useState<ScholarshipCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateCategoryInput>({ slug: '', name: '', description: '', icon: '', sortOrder: 0 });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminScholarshipCategoriesApi.list(adminToken).then(setCategories).catch(() => setCategories([])).finally(() => setIsLoading(false));
  }, [adminToken]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingId(null); setForm({ slug: '', name: '', description: '', icon: '', sortOrder: 0 }); setFormError(null); setShowForm(true); };
  const openEdit = (c: ScholarshipCategory) => { setEditingId(c.id || c._id); setForm({ slug: c.slug, name: c.name, description: c.description ?? '', icon: c.icon ?? '', sortOrder: c.sortOrder }); setFormError(null); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSubmitting(true); setFormError(null);
    try {
      if (editingId) await adminScholarshipCategoriesApi.update(adminToken, editingId, form);
      else await adminScholarshipCategoriesApi.create(adminToken, form);
      setShowForm(false); load();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Could not save category.'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (c: ScholarshipCategory) => {
    if (!adminToken || !confirm(`Delete category "${c.name}"?`)) return;
    try { await adminScholarshipCategoriesApi.remove(adminToken, c.id || c._id); load(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'Delete failed.'); }
  };

  const columns: AdminTableColumn<ScholarshipCategory>[] = [
    { key: 'icon', label: '', render: c => c.icon },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'slug', label: 'Slug' },
    { key: 'sortOrder', label: 'Order' },
  ];

  return (
    <>
      <AdminTable
        columns={columns} rows={categories} rowKey={c => c.id || c._id} isLoading={isLoading}
        toolbarActions={<button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ Add Category</button>}
        page={1} totalPages={1} onPageChange={() => {}} totalCount={categories.length}
        rowActions={c => (
          <>
            <button className="admin-table-action-btn" onClick={() => openEdit(c)}>Edit</button>
            <button className="admin-table-action-btn" data-danger="true" onClick={() => handleDelete(c)}>Delete</button>
          </>
        )}
      />
      {showForm && (
        <AdminModal title={editingId ? 'Edit Category' : 'Add Category'} onClose={() => setShowForm(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} error={formError} submitLabel={editingId ? 'Save Changes' : 'Create Category'}>
          <div className="admin-form-grid">
            <div className="admin-form-group"><label className="admin-form-label">Slug</label>
              <input className="input-editorial" required disabled={!!editingId} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="sc-st" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Icon (emoji)</label>
              <input className="input-editorial" value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="🎓" /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Name</label>
              <input className="input-editorial" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Description</label>
              <textarea className="input-editorial" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Sort Order</label>
              <input type="number" className="input-editorial" value={form.sortOrder} onChange={e => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
          </div>
        </AdminModal>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Providers tab
// ═══════════════════════════════════════════════════════════════════════════

const PROVIDER_TYPES = ['government_central', 'government_state', 'private', 'institution', 'ngo', 'corporate'];

function ProvidersTab() {
  const { adminToken } = useAdminAuth();
  const [providers, setProviders] = useState<ScholarshipProvider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CreateProviderInput>({ name: '', type: 'government_central', website: '', contactEmail: '', contactPhone: '', description: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!adminToken) return;
    setIsLoading(true);
    adminScholarshipProvidersApi.list(adminToken).then(setProviders).catch(() => setProviders([])).finally(() => setIsLoading(false));
  }, [adminToken]);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditingId(null); setForm({ name: '', type: 'government_central', website: '', contactEmail: '', contactPhone: '', description: '' }); setFormError(null); setShowForm(true); };
  const openEdit = (p: ScholarshipProvider) => { setEditingId(p.id || p._id); setForm({ name: p.name, type: p.type, website: p.website ?? '', contactEmail: p.contactEmail ?? '', contactPhone: p.contactPhone ?? '', description: p.description ?? '' }); setFormError(null); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    setIsSubmitting(true); setFormError(null);
    try {
      if (editingId) await adminScholarshipProvidersApi.update(adminToken, editingId, form);
      else await adminScholarshipProvidersApi.create(adminToken, form);
      setShowForm(false); load();
    } catch (err) { setFormError(err instanceof ApiError ? err.message : 'Could not save provider.'); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (p: ScholarshipProvider) => {
    if (!adminToken || !confirm(`Delete provider "${p.name}"?`)) return;
    try { await adminScholarshipProvidersApi.remove(adminToken, p.id || p._id); load(); }
    catch (err) { alert(err instanceof ApiError ? err.message : 'Delete failed.'); }
  };

  const columns: AdminTableColumn<ScholarshipProvider>[] = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'type', label: 'Type', render: p => <span className="admin-status-badge admin-status-info">{p.type.replace(/_/g, ' ')}</span> },
    { key: 'website', label: 'Website', render: p => p.website ? <a href={p.website} target="_blank" rel="noreferrer" className="colleges-contact-link">{p.website}</a> : '—' },
  ];

  return (
    <>
      <AdminTable
        columns={columns} rows={providers} rowKey={p => p.id || p._id} isLoading={isLoading}
        toolbarActions={<button className="btn-editorial-primary" style={{ padding: '9px 18px', fontSize: '13px' }} onClick={openCreate}>+ Add Provider</button>}
        page={1} totalPages={1} onPageChange={() => {}} totalCount={providers.length}
        rowActions={p => (
          <>
            <button className="admin-table-action-btn" onClick={() => openEdit(p)}>Edit</button>
            <button className="admin-table-action-btn" data-danger="true" onClick={() => handleDelete(p)}>Delete</button>
          </>
        )}
      />
      {showForm && (
        <AdminModal title={editingId ? 'Edit Provider' : 'Add Provider'} onClose={() => setShowForm(false)} onSubmit={handleSubmit} isSubmitting={isSubmitting} error={formError} submitLabel={editingId ? 'Save Changes' : 'Create Provider'}>
          <div className="admin-form-grid">
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Name</label>
              <input className="input-editorial" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Type</label>
              <select className="input-editorial" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select></div>
            <div className="admin-form-group"><label className="admin-form-label">Website</label>
              <input className="input-editorial" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
            <div className="admin-form-group"><label className="admin-form-label">Contact Email</label>
              <input className="input-editorial" value={form.contactEmail} onChange={e => setForm({ ...form, contactEmail: e.target.value })} /></div>
            <div className="admin-form-group"><label className="admin-form-label">Contact Phone</label>
              <input className="input-editorial" value={form.contactPhone} onChange={e => setForm({ ...form, contactPhone: e.target.value })} /></div>
            <div className="admin-form-group" data-span="2"><label className="admin-form-label">Description</label>
              <textarea className="input-editorial" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ resize: 'vertical' }} /></div>
          </div>
        </AdminModal>
      )}
    </>
  );
}

export default function ScholarshipsAdminPage() {
  return (
    <Suspense fallback={<div className="admin-loading">Loading…</div>}>
      <ScholarshipsAdminContent />
    </Suspense>
  );
}
