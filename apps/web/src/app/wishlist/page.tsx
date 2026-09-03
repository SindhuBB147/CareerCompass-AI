'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { SavedCollegeCard } from '../../components/colleges/SavedCollegeCard';
import { ApiError } from '../../lib/api-client';
import {
  wishlistApi, type BookmarkStatus, type ListSummary, type SavedCollegeView,
  type WishlistSortBy, type RecentlyViewedItem, type WishlistInsight, type WishlistScoreRow,
} from '../../lib/wishlist-api';

const MAX_COMPARE = 4;

const SORT_OPTIONS: { value: WishlistSortBy; label: string }[] = [
  { value: 'recentlyAdded', label: 'Recently Added' },
  { value: 'nirf', label: 'Best NIRF Rank' },
  { value: 'fees', label: 'Lowest Annual Fee' },
  { value: 'placement', label: 'Highest Placement %' },
  { value: 'roi', label: 'Best ROI' },
  { value: 'admissionProbability', label: 'Highest Admission Probability' },
  { value: 'aiScore', label: 'AI Recommendation Score' },
  { value: 'name', label: 'Alphabetical (A–Z)' },
];

function ListManagerModal({
  initialName, title, submitLabel, onSubmit, onClose,
}: { initialName: string; title: string; submitLabel: string; onSubmit: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(initialName);
  return (
    <div className="admin-modal-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <form
        className="card-editorial admin-modal"
        onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}
      >
        <div className="admin-modal-header">
          <h3 className="font-serif admin-modal-title">{title}</h3>
          <button type="button" className="admin-modal-close" onClick={onClose} aria-label="Close dialog">✕</button>
        </div>
        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="wishlist-list-name">List Name</label>
          <input
            id="wishlist-list-name" className="input-editorial" value={name} autoFocus
            onChange={(e) => setName(e.target.value)} placeholder="e.g. Bangalore Colleges"
          />
        </div>
        <div className="admin-form-actions">
          <button type="button" className="btn-editorial-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-editorial-primary">{submitLabel}</button>
        </div>
      </form>
    </div>
  );
}

export default function WishlistPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();

  const [lists, setLists] = useState<ListSummary[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all'); // 'all' | listId | 'recently-viewed' | 'insights'
  const [sortBy, setSortBy] = useState<WishlistSortBy>('recentlyAdded');
  const [examCode, setExamCode] = useState('');
  const [collegeType, setCollegeType] = useState('');
  const [hostelAvailable, setHostelAvailable] = useState(false);
  const [scholarshipEligible, setScholarshipEligible] = useState(false);

  const [colleges, setColleges] = useState<SavedCollegeView[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedItem[]>([]);
  const [insights, setInsights] = useState<{ insights: WishlistInsight[]; scores: WishlistScoreRow[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [listModal, setListModal] = useState<{ mode: 'create' | 'rename'; listId?: string; name: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    try {
      const res = await wishlistApi.getLists(accessToken);
      setLists(res.lists);
    } catch { setLists([]); }
  }, [accessToken]);

  const loadColleges = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await wishlistApi.getWishlist({
        listId: activeTab !== 'all' && activeTab !== 'recently-viewed' && activeTab !== 'insights' ? activeTab : undefined,
        sortBy,
        examCode: examCode || undefined,
        collegeType: collegeType || undefined,
        hostelAvailable: hostelAvailable || undefined,
        scholarshipEligible: scholarshipEligible || undefined,
      }, accessToken);
      setColleges(res.colleges);
      setLists(res.lists);
    } catch { setColleges([]); } finally { setIsLoading(false); }
  }, [accessToken, activeTab, sortBy, examCode, collegeType, hostelAvailable, scholarshipEligible]);

  const loadRecentlyViewed = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await wishlistApi.getRecentlyViewed(accessToken);
      setRecentlyViewed(res.items);
    } catch { setRecentlyViewed([]); } finally { setIsLoading(false); }
  }, [accessToken]);

  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    try {
      setInsights(await wishlistApi.getInsights(accessToken));
    } catch { setInsights({ insights: [], scores: [] }); } finally { setIsLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }
    loadLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    if (activeTab === 'recently-viewed') loadRecentlyViewed();
    else if (activeTab === 'insights') loadInsights();
    else loadColleges();
  }, [authLoading, isAuthenticated, activeTab, sortBy, examCode, collegeType, hostelAvailable, scholarshipEligible, loadColleges, loadRecentlyViewed, loadInsights]);

  const flash = (text: string) => { setMessage(text); setTimeout(() => setMessage(null), 2500); };

  const handleRemove = async (collegeId: string) => {
    setColleges((prev) => prev.filter((c) => c.collegeId !== collegeId));
    try { await wishlistApi.remove(collegeId, accessToken); loadLists(); flash('Removed from wishlist'); } catch { loadColleges(); }
  };

  const handleStatusChange = async (collegeId: string, status: BookmarkStatus) => {
    setColleges((prev) => prev.map((c) => (c.collegeId === collegeId ? { ...c, status } : c)));
    try { await wishlistApi.setStatus(collegeId, status, accessToken); } catch { loadColleges(); }
  };

  const handleAddNote = async (collegeId: string, text: string) => {
    try {
      const note = await wishlistApi.addNote(collegeId, text, accessToken);
      setColleges((prev) => prev.map((c) => (c.collegeId === collegeId ? { ...c, notes: [...c.notes, note] } : c)));
    } catch { /* no-op — note stays out of the list on failure */ }
  };

  const handleRemoveNote = async (collegeId: string, noteId: string) => {
    setColleges((prev) => prev.map((c) => (c.collegeId === collegeId ? { ...c, notes: c.notes.filter((n) => n.id !== noteId) } : c)));
    try { await wishlistApi.removeNote(collegeId, noteId, accessToken); } catch { loadColleges(); }
  };

  const handleToggleCompare = (collegeId: string) => {
    setCompareIds((prev) => (prev.includes(collegeId) ? prev.filter((id) => id !== collegeId) : prev.length >= MAX_COMPARE ? prev : [...prev, collegeId]));
  };

  const handleRestore = async (collegeId: string) => {
    try { await wishlistApi.save(collegeId, undefined, accessToken); loadLists(); flash('Restored to Favorites'); } catch { /* no-op */ }
  };

  const handleCreateList = async (name: string) => {
    try { await wishlistApi.createList(name, undefined, accessToken); setListModal(null); loadLists(); flash('List created'); }
    catch (err) { flash(err instanceof ApiError ? err.message : 'Could not create list'); }
  };

  const handleRenameList = async (listId: string, name: string) => {
    try { await wishlistApi.renameList(listId, name, accessToken); setListModal(null); loadLists(); }
    catch (err) { flash(err instanceof ApiError ? err.message : 'Could not rename list'); }
  };

  const handleDeleteList = async (list: ListSummary) => {
    if (list.type === 'default') return;
    if (!confirm(`Delete "${list.name}"? Colleges in it stay saved but leave this list.`)) return;
    await wishlistApi.deleteList(list.id, accessToken);
    if (activeTab === list.id) setActiveTab('all');
    loadLists();
  };

  const handleDuplicateList = async (list: ListSummary) => {
    await wishlistApi.duplicateList(list.id, accessToken);
    loadLists();
    flash(`Duplicated "${list.name}"`);
  };

  if (authLoading || !isAuthenticated) return null;

  const activeListName = lists.find((l) => l.id === activeTab)?.name;

  return (
    <div className="colleges-page wishlist-page">
      <section className="colleges-hero">
        <div className="container-editorial colleges-hero-inner">
          <span className="colleges-hero-eyebrow">Your Saved Colleges</span>
          <h1 className="text-section-title font-serif colleges-hero-title">Wishlist</h1>
          <p className="text-body colleges-hero-subtitle">
            Organize saved colleges into lists, track admission status, compare your top picks, and see AI insights across your shortlist.
          </p>
        </div>
      </section>

      <div className="container-editorial colleges-content">
        {message && <div className="wishlist-flash" role="status">{message}</div>}

        <div className="wishlist-tabs">
          <button type="button" className="wishlist-tab" data-active={activeTab === 'all'} onClick={() => setActiveTab('all')}>
            All Saved
          </button>
          {/* The 'recently_viewed' default list exists server-side so a college
              save-then-remove still round-trips through Favorites correctly,
              but it's not a list students add things to directly — the
              dedicated "Recently Viewed" button below covers that view. */}
          {lists.filter((list) => list.key !== 'recently_viewed').map((list) => (
            <div key={list.id} className="wishlist-tab-group">
              <button type="button" className="wishlist-tab" data-active={activeTab === list.id} onClick={() => setActiveTab(list.id)}>
                {list.icon} {list.name} <span className="wishlist-tab-count">{list.itemCount}</span>
              </button>
              {list.type === 'custom' && (
                <div className="wishlist-tab-menu">
                  <button type="button" onClick={() => setListModal({ mode: 'rename', listId: list.id, name: list.name })} title="Rename">✏️</button>
                  <button type="button" onClick={() => handleDuplicateList(list)} title="Duplicate">📄</button>
                  <button type="button" onClick={() => handleDeleteList(list)} title="Delete">🗑️</button>
                </div>
              )}
            </div>
          ))}
          <button type="button" className="wishlist-tab" data-active={activeTab === 'recently-viewed'} onClick={() => setActiveTab('recently-viewed')}>
            📌 Recently Viewed
          </button>
          <button type="button" className="wishlist-tab" data-active={activeTab === 'insights'} onClick={() => setActiveTab('insights')}>
            ✨ AI Insights
          </button>
          <button type="button" className="btn-editorial-secondary wishlist-new-list-btn" onClick={() => setListModal({ mode: 'create', name: '' })}>
            + New List
          </button>
        </div>

        {activeTab !== 'recently-viewed' && activeTab !== 'insights' && (
          <div className="card-editorial colleges-toolbar wishlist-toolbar">
            <span className="colleges-toolbar-count">
              {isLoading ? 'Loading…' : `${colleges.length} college${colleges.length === 1 ? '' : 's'}${activeListName ? ` in ${activeListName}` : ''}`}
            </span>
            <div className="wishlist-filter-row">
              <select className="input-editorial colleges-toolbar-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as WishlistSortBy)}>
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="input-editorial colleges-toolbar-select" value={examCode} onChange={(e) => setExamCode(e.target.value)}>
                <option value="">All Exams</option>
                <option value="KCET">KCET</option>
                <option value="COMEDK">COMEDK</option>
                <option value="NEET">NEET</option>
              </select>
              <select className="input-editorial colleges-toolbar-select" value={collegeType} onChange={(e) => setCollegeType(e.target.value)}>
                <option value="">All Types</option>
                <option value="Government">Government</option>
                <option value="Private">Private</option>
                <option value="Autonomous">Autonomous</option>
                <option value="Deemed">University / Deemed</option>
              </select>
              <label className="wishlist-checkbox-filter">
                <input type="checkbox" checked={hostelAvailable} onChange={(e) => setHostelAvailable(e.target.checked)} /> Hostel
              </label>
              <label className="wishlist-checkbox-filter">
                <input type="checkbox" checked={scholarshipEligible} onChange={(e) => setScholarshipEligible(e.target.checked)} /> Scholarship Eligible
              </label>
            </div>
          </div>
        )}

        {activeTab === 'recently-viewed' ? (
          <RecentlyViewedPanel
            items={recentlyViewed} isLoading={isLoading}
            onClear={async () => { await wishlistApi.clearRecentlyViewed(accessToken); loadRecentlyViewed(); }}
            onRestore={handleRestore}
          />
        ) : activeTab === 'insights' ? (
          <InsightsPanel data={insights} isLoading={isLoading} />
        ) : isLoading ? (
          <div className="colleges-grid-cards" aria-busy="true">
            {[1, 2, 3].map((i) => <div key={i} className="card-editorial colleges-card-skeleton" />)}
          </div>
        ) : colleges.length === 0 ? (
          <div className="card-editorial colleges-empty-state">
            <div className="colleges-empty-icon">💔</div>
            <h3 className="font-serif colleges-empty-title">Nothing Saved Here Yet</h3>
            <p className="text-body colleges-empty-desc">Save colleges from the Explorer to start building your wishlist.</p>
            <Link href="/colleges" className="btn-editorial-primary">Browse Colleges</Link>
          </div>
        ) : (
          <div className="colleges-grid-cards">
            {colleges.map((item) => (
              <SavedCollegeCard
                key={item.collegeId}
                item={item}
                onRemove={handleRemove}
                onStatusChange={handleStatusChange}
                onAddNote={handleAddNote}
                onRemoveNote={handleRemoveNote}
                isSelectedForCompare={compareIds.includes(item.collegeId)}
                onToggleCompare={handleToggleCompare}
                compareDisabled={compareIds.length >= MAX_COMPARE}
              />
            ))}
          </div>
        )}
      </div>

      {compareIds.length > 0 && (
        <div className="colleges-compare-bar" role="status">
          <span className="colleges-compare-bar-text">{compareIds.length}/{MAX_COMPARE} Colleges Selected for Comparison</span>
          <button type="button" onClick={() => setCompareIds([])} className="colleges-compare-bar-clear">Clear</button>
          {compareIds.length >= 2 ? (
            <Link href={`/wishlist/compare?ids=${compareIds.join(',')}`} className="btn-editorial-primary colleges-compare-bar-cta">Compare Now →</Link>
          ) : (
            <span className="colleges-compare-bar-hint">Select at least 2 to compare</span>
          )}
        </div>
      )}

      {listModal && (
        <ListManagerModal
          title={listModal.mode === 'create' ? 'Create New List' : 'Rename List'}
          submitLabel={listModal.mode === 'create' ? 'Create' : 'Save'}
          initialName={listModal.name}
          onClose={() => setListModal(null)}
          onSubmit={(name) => (listModal.mode === 'create' ? handleCreateList(name) : handleRenameList(listModal.listId!, name))}
        />
      )}
    </div>
  );
}

function RecentlyViewedPanel({
  items, isLoading, onClear, onRestore,
}: { items: RecentlyViewedItem[]; isLoading: boolean; onClear: () => void; onRestore: (collegeId: string) => void }) {
  if (isLoading) return <div className="card-editorial" style={{ padding: '48px', textAlign: 'center' }}>Loading…</div>;
  if (items.length === 0) {
    return (
      <div className="card-editorial colleges-empty-state">
        <div className="colleges-empty-icon">📌</div>
        <h3 className="font-serif colleges-empty-title">No Recently Viewed Colleges</h3>
        <p className="text-body colleges-empty-desc">Colleges you view on the Explorer will show up here.</p>
      </div>
    );
  }
  return (
    <div className="wishlist-recently-viewed">
      <div className="wishlist-recently-viewed-header">
        <span className="text-body">Colleges you've recently looked at — save one again if you removed it by mistake.</span>
        <button type="button" className="btn-editorial-secondary" onClick={onClear}>Clear History</button>
      </div>
      <div className="wishlist-recently-viewed-list">
        {items.map((item) => (
          <div key={item.collegeId} className="card-editorial wishlist-recently-viewed-row">
            <img src={item.college.logo} alt="" className="colleges-compare-logo" />
            <div className="wishlist-recently-viewed-info">
              <Link href={`/colleges/${item.college.slug}`} className="colleges-compare-name">{item.college.name}</Link>
              <span className="colleges-card-location">📍 {item.college.city}, {item.college.state} • Viewed {new Date(item.viewedAt).toLocaleDateString('en-IN')}</span>
            </div>
            <button type="button" className="btn-editorial-secondary" onClick={() => onRestore(item.collegeId)}>♡ Save Again</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsPanel({ data, isLoading }: { data: { insights: WishlistInsight[]; scores: WishlistScoreRow[] } | null; isLoading: boolean }) {
  if (isLoading || !data) return <div className="card-editorial" style={{ padding: '48px', textAlign: 'center' }}>Generating insights…</div>;
  if (data.insights.length === 0) {
    return (
      <div className="card-editorial colleges-empty-state">
        <div className="colleges-empty-icon">✨</div>
        <h3 className="font-serif colleges-empty-title">Save a Few Colleges to Unlock AI Insights</h3>
        <p className="text-body colleges-empty-desc">Insights compare your saved colleges once you have at least one saved.</p>
      </div>
    );
  }
  return (
    <div className="wishlist-insights">
      <div className="wishlist-insight-cards">
        {data.insights.map((insight, idx) => (
          <div key={idx} className="card-editorial wishlist-insight-card">
            <span className="wishlist-insight-icon">{insight.icon}</span>
            <p className="text-body">{insight.text}</p>
          </div>
        ))}
      </div>
      <div className="card-editorial wishlist-score-table-wrap">
        <h3 className="font-serif colleges-section-title">AI Recommendation Scores</h3>
        <table className="colleges-compare-table wishlist-score-table">
          <thead>
            <tr>
              <th className="colleges-compare-row-label">College</th>
              <th>AI Score</th>
              <th>Admission %</th>
              <th>ROI %</th>
              <th>Scholarships</th>
              <th>Budget Fit</th>
            </tr>
          </thead>
          <tbody>
            {data.scores.sort((a, b) => b.aiRecommendationScore - a.aiRecommendationScore).map((row) => (
              <tr key={row.collegeId}>
                <td className="colleges-compare-row-label">{row.collegeName}</td>
                <td>{row.aiRecommendationScore}</td>
                <td>{row.admissionProbability != null ? `${row.admissionProbability}%` : '—'}</td>
                <td>{row.roiPercent != null ? `${row.roiPercent}%` : '—'}</td>
                <td>{row.scholarshipEligible ? 'Yes' : 'No'}</td>
                <td>{row.budgetFit == null ? '—' : row.budgetFit ? '✅' : '⚠️'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
