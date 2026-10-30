'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '../../../contexts/AdminAuthContext';
import { ApiError } from '../../../lib/api-client';
import { adminCutoffsApi, type BulkCutoffRow } from '../../../lib/admin-api';
import { collegesApi, type College } from '../../../lib/colleges-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';

const EXAM_OPTIONS = ['KCET', 'COMEDK', 'NEET', 'JEE'];
const FALLBACK_CATEGORIES = ['GM'];

interface FormState {
  examCode: string; courseId: string; year: string; round: string; category: string; closingRank: string;
}

function emptyForm(examCode = 'KCET'): FormState {
  return {
    examCode, courseId: '', year: String(new Date().getFullYear()), round: '1',
    category: 'GM', closingRank: '',
  };
}

export function AddCutoffTab() {
  const { adminToken } = useAdminAuth();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<College[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState<College | null>(null);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [categoryOptions, setCategoryOptions] = useState<string[]>(FALLBACK_CATEGORIES);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!debouncedQuery.trim() || selectedCollege) { setResults([]); return; }
    setIsSearching(true);
    collegesApi.search({ q: debouncedQuery.trim(), limit: 8 })
      .then((res) => setResults(res.results))
      .catch(() => setResults([]))
      .finally(() => setIsSearching(false));
  }, [debouncedQuery, selectedCollege]);

  // Category options are exam-driven (not data-driven) so a brand-new college/course with
  // zero existing cutoffs still gets the exam's real category codes to pick from.
  useEffect(() => {
    collegesApi.getExamCategories(form.examCode).then((res) => {
      const options = res.categories.length ? res.categories : FALLBACK_CATEGORIES;
      setCategoryOptions(options);
      setForm((f) => (options.includes(f.category) ? f : { ...f, category: options[0] }));
    }).catch(() => setCategoryOptions(FALLBACK_CATEGORIES));
  }, [form.examCode]);

  const selectCollege = (college: College) => {
    // Search results are lean-serialized and may omit the `id` virtual — normalize it
    // from `_id` here so every downstream lookup/link has a real, non-"undefined" ID.
    setSelectedCollege({ ...college, id: college.id || college._id });
    setQuery(college.name);
    setResults([]);
    setForm(emptyForm());
    setSuccessMessage(null);
    setFormError(null);
  };

  const clearCollege = () => {
    setSelectedCollege(null);
    setQuery('');
    setForm(emptyForm());
    setSuccessMessage(null);
  };

  const validate = (): string | null => {
    if (!selectedCollege) return 'Search for and select a college first.';
    if (!form.courseId) return 'Select a course.';
    if (!form.year || !form.round) return 'Year and round are required.';
    if (!form.category.trim()) return 'Category is required.';
    if (!form.closingRank) return 'Closing rank is required.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || !selectedCollege) return;
    const validationError = validate();
    if (validationError) { setFormError(validationError); return; }

    setIsSubmitting(true);
    setFormError(null);
    setSuccessMessage(null);
    try {
      const courseName = selectedCollege.courses.find((c) => c.courseId === form.courseId)?.name;
      const row: BulkCutoffRow = {
        collegeId: selectedCollege.id, courseId: form.courseId, courseName,
        examCode: form.examCode, year: Number(form.year), round: Number(form.round),
        category: form.category.trim(),
        closingRank: Number(form.closingRank),
      };
      await adminCutoffsApi.create(adminToken, row);
      setSuccessMessage(`Cutoff saved for ${courseName || form.courseId} at ${selectedCollege.name} (${form.examCode} · ${form.year} · R${form.round} · ${row.category}).`);
      setForm(emptyForm(form.examCode));
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save cutoff record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>
      <div className="card-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h3 className="font-serif" style={{ fontSize: '18px', margin: 0 }}>Add a Single Cutoff Record</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
            Search for the college, pick one of its courses, then fill in the exam, year, round, and category details.
          </p>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label">College</label>
          {selectedCollege ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid var(--border-color, #ddd)', borderRadius: '8px' }}>
              <div style={{ flex: 1 }}>
                <strong>{selectedCollege.name}</strong>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {selectedCollege.collegeId ? `${selectedCollege.collegeId} · ` : ''}{selectedCollege.city}, {selectedCollege.state}
                </div>
              </div>
              <button type="button" className="admin-table-action-btn" onClick={clearCollege}>Change</button>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <input
                className="input-editorial"
                placeholder="Search college by name or code…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {(isSearching || query.trim().length > 0) && (
                <div className="card-editorial" style={{ position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, marginTop: '4px', maxHeight: '260px', overflowY: 'auto', padding: '6px' }}>
                  {isSearching ? (
                    <div style={{ padding: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>Searching…</div>
                  ) : results.length === 0 ? (
                    <div style={{ padding: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>No colleges matched.</div>
                  ) : results.map((c) => (
                    <button
                      key={c.id || c._id}
                      type="button"
                      onClick={() => selectCollege(c)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'none', cursor: 'pointer', borderRadius: '6px' }}
                      className="admin-table-action-btn"
                    >
                      <strong>{c.name}</strong>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.collegeId ? `${c.collegeId} · ` : ''}{c.city}, {c.state}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {selectedCollege && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="admin-form-grid">
              <div className="admin-form-group">
                <label className="admin-form-label">Exam</label>
                <select className="input-editorial" value={form.examCode} onChange={(e) => setForm({ ...form, examCode: e.target.value })}>
                  {EXAM_OPTIONS.map((ex) => <option key={ex} value={ex}>{ex}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Course</label>
                <select className="input-editorial" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
                  <option value="">Select course…</option>
                  {selectedCollege.courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.name} ({c.courseId})</option>)}
                </select>
                {selectedCollege.courses.length === 0 && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>This college has no courses yet — add one first.</span>}
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Academic Year</label>
                <input type="number" className="input-editorial" required value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Round</label>
                <input type="number" min={1} className="input-editorial" required value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Category</label>
                <select className="input-editorial" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Closing Rank</label>
                <input type="number" min={1} className="input-editorial" required value={form.closingRank} onChange={(e) => setForm({ ...form, closingRank: e.target.value })} />
              </div>
            </div>

            {formError && <div className="admin-inline-message" data-tone="error">{formError}</div>}
            {successMessage && (
              <div className="admin-inline-message" data-tone="success">
                ✓ {successMessage} <Link href={`/admin/colleges/${selectedCollege.id}?tab=cutoffs`}>View on college&apos;s Cutoffs tab →</Link>
              </div>
            )}

            <button type="submit" className="btn-editorial-primary" disabled={isSubmitting} style={{ alignSelf: 'flex-start' }}>
              {isSubmitting ? 'Saving…' : '+ Add Cutoff'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
