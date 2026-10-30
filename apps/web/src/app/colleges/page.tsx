'use client';

import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
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
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const activeSearchRef = useRef<AbortController | null>(null);
  const searchSequenceRef = useRef(0);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const debouncedQuery = useDebouncedValue(searchQuery, 450);

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
    const query = debouncedQuery.trim();
    if (query.length === 1) {
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    const controller = new AbortController();
    const sequence = searchSequenceRef.current;
    activeSearchRef.current = controller;
    setIsLoading(true);
    setSearchError(null);
    collegesApi
      .search({
        q: query.length >= 2 ? query : undefined,
        examCode,
        sortBy,
        sortOrder: sortBy === 'fees' ? 'asc' : undefined,
        page,
        limit: 12,
        ...filtersToParams(filters),
      }, controller.signal)
      .then((res) => {
        if (controller.signal.aborted || sequence !== searchSequenceRef.current) return;
        setColleges(res.results);
        setTotalPages(res.totalPages);
        setTotalResults(res.totalResults);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || sequence !== searchSequenceRef.current) return;
        setSearchError(error instanceof Error ? error.message : 'College search failed. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === searchSequenceRef.current) setIsLoading(false);
      });
    return () => {
      controller.abort();
      if (activeSearchRef.current === controller) activeSearchRef.current = null;
    };
  }, [examCode, debouncedQuery, filters, sortBy, page, retryToken]);

  const handleSearchChange = useCallback((query: string) => {
    searchSequenceRef.current += 1;
    activeSearchRef.current?.abort();
    activeSearchRef.current = null;
    setPage(1);
    setSearchError(null);
    setIsLoading(query.trim().length >= 2);
    setSearchQuery(query);
  }, []);

  const handleFiltersChange = useCallback((next: CollegeFilterState) => {
    setPage(1);
    setFilters(next);
  }, []);

  const queryTooShort = searchQuery.trim().length === 1;

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
    setPage(1);
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

          <ExamTabs value={examCode} onChange={(next) => { setPage(1); setExamCode(next); }} />

          <CollegeSearchBar value={searchQuery} onChange={handleSearchChange} examCode={examCode} />

          <div className="colleges-quick-chips">
            {QUICK_FILTERS.map((qf) => (
              <button key={qf.label} type="button" className="colleges-quick-chip" onClick={() => handleFiltersChange(qf.apply(filters))}>
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
              onChange={(e) => { setPage(1); setSortBy(e.target.value as SortOption); }}
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
            onChange={handleFiltersChange}
            facets={facets}
            resultCount={colleges.length}
            totalCount={totalResults}
          />

          <div className="colleges-grid-column">
            {queryTooShort ? (
              <div className="card-editorial colleges-empty-state" role="status">Type at least 2 characters to search.</div>
            ) : <CollegeGrid
              colleges={colleges}
              isLoading={isLoading}
              error={searchError}
              onRetry={() => setRetryToken((n) => n + 1)}
              favorites={favorites}
              onToggleFavorite={handleToggleFavorite}
              compareIds={compareIds}
              onToggleCompare={handleToggleCompare}
              maxCompare={MAX_COMPARE}
              onResetFilters={resetAll}
            />}

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
