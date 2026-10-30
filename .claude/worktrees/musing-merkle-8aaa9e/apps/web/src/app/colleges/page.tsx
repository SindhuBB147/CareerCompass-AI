'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { collegesApi, type College, type CollegeFacets, type ExamCode } from '../../lib/colleges-api';
import { wishlistApi } from '../../lib/wishlist-api';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ExamTabs } from '../../components/colleges/ExamTabs';
import { CollegeSearchBar } from '../../components/colleges/CollegeSearchBar';
import { FilterPanel, DEFAULT_FILTERS, filtersToParams, type CollegeFilterState } from '../../components/colleges/FilterPanel';
import { CollegeGrid } from '../../components/colleges/CollegeGrid';
import { Pagination } from '../../components/colleges/Pagination';
import { CompareBar } from '../../components/colleges/CompareBar';
import { readCompareIds, toggleCompareId, clearCompareIds, mergeCompareIds, MAX_COMPARE } from '../../lib/colleges-storage';

type SortOption = 'nirf' | 'fees' | 'placement' | 'name' | 'rating';

const QUICK_FILTERS: { label: string; apply: (f: CollegeFilterState) => CollegeFilterState }[] = [
  { label: 'Top 100 NIRF', apply: (f) => ({ ...f, maxNirf: 100 }) },
  { label: 'Government Colleges', apply: (f) => ({ ...f, collegeTypes: ['Government'] }) },
  { label: 'Hostel Available', apply: (f) => ({ ...f, hostelAvailable: true }) },
  { label: 'NAAC A+ & Above', apply: (f) => ({ ...f, naac: 'A+' }) },
];

function CollegesDirectoryPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, accessToken } = useUserAuth();
  const [examCode, setExamCode] = useState<ExamCode>('KCET');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<CollegeFilterState>(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState<SortOption>('nirf');
  const [page, setPage] = useState(1);

  const [facets, setFacets] = useState<CollegeFacets | null>(null);
  const [colleges, setColleges] = useState<College[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const debouncedQuery = useDebouncedValue(searchQuery, 350);

  useEffect(() => {
    // AI Counsellor "Compare Colleges" quick action deep-links here with
    // ?collegeIds=a,b,c — merge those into the existing localStorage
    // selection so it behaves the same as manually checking "Compare" on
    // each college, instead of a separate one-off comparison mechanism.
    const fromQuery = (searchParams.get('collegeIds') ?? '').split(',').map(id => id.trim()).filter(Boolean);
    setCompareIds(fromQuery.length > 0 ? mergeCompareIds(fromQuery) : readCompareIds());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Saved-colleges state now lives server-side (Saved Colleges & Wishlist
  // module) instead of localStorage — fetched once per page load so
  // CollegeCard's existing isFavorite/onToggleFavorite props (unchanged)
  // just get a different data source.
  useEffect(() => {
    if (!isAuthenticated) { setFavorites([]); return; }
    wishlistApi.getWishlist({}, accessToken)
      .then((res) => setFavorites(res.colleges.map((c) => c.collegeId)))
      .catch(() => setFavorites([]));
  }, [isAuthenticated, accessToken]);

  // Filter options are scoped to the selected exam (e.g. NEET should never
  // offer "Computer Science" as a course option) — refetch on exam change
  // and reset filters, since a filter value valid for one exam may not
  // exist for another.
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    collegesApi.getFacets(examCode).then(setFacets).catch(() => setFacets(null));
  }, [examCode]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filters, sortBy]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    collegesApi
      .search({
        q: debouncedQuery || undefined,
        examCode,
        sortBy,
        sortOrder: sortBy === 'fees' ? 'asc' : undefined,
        page,
        limit: 12,
        ...filtersToParams(filters),
      })
      .then((res) => {
        if (cancelled) return;
        setColleges(res.results);
        setTotalPages(res.totalPages);
        setTotalResults(res.totalResults);
      })
      .catch(() => {
        if (cancelled) return;
        setColleges([]);
        setTotalPages(1);
        setTotalResults(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [examCode, debouncedQuery, filters, sortBy, page]);

  const handleToggleFavorite = useCallback((id: string) => {
    if (!isAuthenticated) { router.push('/login/student'); return; }
    const wasSaved = favorites.includes(id);
    setFavorites((prev) => (wasSaved ? prev.filter((f) => f !== id) : [...prev, id])); // instant feedback
    const action = wasSaved ? wishlistApi.remove(id, accessToken) : wishlistApi.save(id, undefined, accessToken);
    action.catch(() => {
      setFavorites((prev) => (wasSaved ? [...prev, id] : prev.filter((f) => f !== id))); // revert on failure
    });
  }, [isAuthenticated, accessToken, favorites, router]);

  const handleToggleCompare = useCallback((id: string) => {
    setCompareIds(toggleCompareId(id));
  }, []);

  const resetAll = useCallback(() => {
    setSearchQuery('');
    setFilters(DEFAULT_FILTERS);
    setSortBy('nirf');
  }, []);

  return (
    <div className="colleges-page">
      {/* HERO */}
      <section className="colleges-hero">
        <div className="container-editorial colleges-hero-inner">
          <span className="colleges-hero-eyebrow">Karnataka College Explorer 2026</span>
          <h1 className="text-section-title font-serif colleges-hero-title">Explore Colleges</h1>
          <p className="text-body colleges-hero-subtitle">
            Find the best colleges based on your entrance exam, preferred course, location, fees, placements, and admission chances.
          </p>

          <ExamTabs value={examCode} onChange={setExamCode} />

          <CollegeSearchBar value={searchQuery} onChange={setSearchQuery} examCode={examCode} />

          <div className="colleges-quick-chips">
            {QUICK_FILTERS.map((qf) => (
              <button key={qf.label} type="button" className="colleges-quick-chip" onClick={() => setFilters(qf.apply(filters))}>
                {qf.label}
              </button>
            ))}
            <Link href="/wishlist" className="colleges-watchlist-link">
              ❤️ My Watchlist
              {favorites.length > 0 && <span className="colleges-watchlist-count">{favorites.length}</span>}
            </Link>
          </div>
        </div>
      </section>

      <div className="container-editorial colleges-content">
        {/* SORT TOOLBAR */}
        <div className="card-editorial colleges-toolbar">
          <span className="colleges-toolbar-count">
            {isLoading ? 'Searching…' : `${totalResults} college${totalResults === 1 ? '' : 's'} found`}
          </span>
          <div className="colleges-toolbar-sort">
            <label htmlFor="sort-by" className="colleges-toolbar-sort-label">Sort By</label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="input-editorial colleges-toolbar-select"
            >
              <option value="nirf">Best NIRF Rank</option>
              <option value="fees">Lowest Annual Fee</option>
              <option value="placement">Highest Placement Package</option>
              <option value="rating">Highest Rated</option>
              <option value="name">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* FILTER SIDEBAR + GRID */}
        <div className="colleges-filter-layout">
          <FilterPanel
            examCode={examCode}
            filters={filters}
            onChange={setFilters}
            facets={facets}
            resultCount={colleges.length}
            totalCount={totalResults}
          />

          <div className="colleges-grid-column">
            <CollegeGrid
              colleges={colleges}
              isLoading={isLoading}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              compareIds={compareIds}
              onToggleCompare={handleToggleCompare}
              maxCompare={MAX_COMPARE}
              onResetFilters={resetAll}
            />

            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </div>
        </div>
      </div>

      <CompareBar compareIds={compareIds} onClear={() => setCompareIds(clearCompareIds())} />
    </div>
  );
}

export default function CollegesDirectoryPage() {
  return (
    <Suspense fallback={<div className="section-padding container-editorial" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <CollegesDirectoryPageInner />
    </Suspense>
  );
}
