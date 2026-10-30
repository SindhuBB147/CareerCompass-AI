'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ExamTabs } from '../../components/colleges/ExamTabs';
import { Pagination } from '../../components/colleges/Pagination';
import { ScholarshipCard } from '../../components/scholarships/ScholarshipCard';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { scholarshipsApi, type Scholarship, type ScholarshipRecommendation } from '../../lib/scholarships-api';
import { searchApi, type SearchSuggestions } from '../../lib/search-api';
import type { ExamCode } from '../../lib/colleges-api';

const PAGE_SIZE = 9;

function ScholarshipsPageInner() {
  const { isAuthenticated, accessToken } = useUserAuth();
  // AI Counsellor "Apply Scholarship" quick action deep-links here with
  // ?scholarshipId=... — scrolled to and highlighted once results load.
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('scholarshipId');

  const [exam, setExam] = useState<ExamCode>('KCET');
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<SearchSuggestions | null>(null);
  const searchBarRef = useRef<HTMLDivElement>(null);

  const { listening, speechSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => { setQ(transcript); setSearchFocused(false); },
  });

  useEffect(() => {
    if (searchFocused && !aiSuggestions) {
      searchApi.getSuggestions().then(setAiSuggestions).catch(() => setAiSuggestions(null));
    }
  }, [searchFocused, aiSuggestions]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBarRef.current && !searchBarRef.current.contains(e.target as Node)) setSearchFocused(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const [recommendations, setRecommendations] = useState<ScholarshipRecommendation[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  useEffect(() => { setPage(1); }, [exam, debouncedQ, bookmarkedOnly]);

  useEffect(() => {
    if (!highlightId || scholarships.length === 0) return;
    document.getElementById(`scholarship-${highlightId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId, scholarships]);

  const loadBookmarks = useCallback(async () => {
    if (!isAuthenticated || !accessToken) { setBookmarkedIds(new Set()); return; }
    try {
      const res = await scholarshipsApi.listBookmarks(accessToken);
      setBookmarkedIds(new Set(res.scholarships.map(s => s.id || s._id)));
    } catch {
      setBookmarkedIds(new Set());
    }
  }, [isAuthenticated, accessToken]);

  useEffect(() => { loadBookmarks(); }, [loadBookmarks]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) { setRecommendations([]); return; }
    scholarshipsApi.getRecommended(accessToken, 6)
      .then(res => setRecommendations(res.recommendations))
      .catch(() => setRecommendations([]));
  }, [isAuthenticated, accessToken]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    if (bookmarkedOnly) {
      if (!accessToken) { setScholarships([]); setTotalResults(0); setIsLoading(false); return; }
      scholarshipsApi.listBookmarks(accessToken)
        .then(res => {
          if (cancelled) return;
          setScholarships(res.scholarships);
          setTotalResults(res.scholarships.length);
        })
        .catch(() => { if (!cancelled) { setScholarships([]); setTotalResults(0); } })
        .finally(() => { if (!cancelled) setIsLoading(false); });
      return () => { cancelled = true; };
    }

    scholarshipsApi.search({
      q: debouncedQ || undefined,
      exam,
      status: 'open',
      sortBy: 'deadline',
      page, limit: PAGE_SIZE,
    })
      .then(res => {
        if (cancelled) return;
        setScholarships(res.scholarships);
        setTotalResults(res.totalResults);
      })
      .catch(() => { if (!cancelled) { setScholarships([]); setTotalResults(0); } })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [exam, debouncedQ, page, bookmarkedOnly, accessToken]);

  const toggleBookmark = async (scholarship: Scholarship) => {
    if (!accessToken) return;
    const id = scholarship.id || scholarship._id;
    const isBookmarked = bookmarkedIds.has(id);
    const next = new Set(bookmarkedIds);
    isBookmarked ? next.delete(id) : next.add(id);
    setBookmarkedIds(next);
    try {
      if (isBookmarked) await scholarshipsApi.removeBookmark(accessToken, id);
      else await scholarshipsApi.addBookmark(accessToken, id);
    } catch {
      loadBookmarks();
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalResults / PAGE_SIZE));

  return (
    <div className="scholarship-page">
      <section className="scholarship-hero colleges-hero">
        <div className="container-editorial scholarship-hero-inner colleges-hero-inner">
          <span className="colleges-hero-eyebrow">Financial Assistance Matcher</span>
          <h1 className="text-section-title font-serif colleges-hero-title">Scholarship Discovery</h1>
          <p className="text-body colleges-hero-subtitle">
            Verified government, AICTE, institutional, and private scholarships — matched to your exam, category, income, and reservation profile.
          </p>
          <ExamTabs value={exam} onChange={setExam} />
        </div>
      </section>

      <div className="container-editorial scholarship-content">
        {isAuthenticated && recommendations.length > 0 && (
          <section>
            <div className="colleges-section-header-row" style={{ marginBottom: '16px' }}>
              <h2 className="font-serif colleges-section-title-sm">✨ Recommended For You</h2>
              <p className="text-body colleges-section-subtitle">Based on your profile — category, exam rank, income, and preferences.</p>
            </div>
            <div className="scholarship-recommended-strip">
              {recommendations.map(rec => (
                <ScholarshipCard
                  key={rec.scholarship.id || rec.scholarship._id}
                  scholarship={rec.scholarship}
                  tier={rec.tier}
                  tierLabel={rec.tierLabel}
                  isBookmarked={bookmarkedIds.has(rec.scholarship.id || rec.scholarship._id)}
                  onToggleBookmark={isAuthenticated ? toggleBookmark : undefined}
                />
              ))}
            </div>
          </section>
        )}

        <div className="colleges-search-bar" ref={searchBarRef} role="search">
          <span className="colleges-search-icon">🔍</span>
          <input
            type="text" className="input-editorial colleges-search-input"
            placeholder="Search by scholarship name, provider, or keyword…"
            value={q} onChange={e => setQ(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={e => { if (e.key === 'Escape') setSearchFocused(false); }}
          />
          {speechSupported && (
            <button
              type="button" className="smart-search-mic" onClick={toggleListening}
              aria-label={listening ? 'Stop voice search' : 'Search by voice'}
              title={listening ? 'Listening…' : 'Search by voice'}
              style={{ color: listening ? 'var(--accent-blue)' : undefined }}
            >
              {listening ? '●' : '🎤'}
            </button>
          )}
          {q && <button type="button" className="colleges-search-clear" onClick={() => setQ('')}>✕</button>}

          {searchFocused && !q.trim() && aiSuggestions && (aiSuggestions.trendingSearches.length > 0 || aiSuggestions.suggestedQueries.length > 0) && (
            <div className="colleges-search-dropdown" role="listbox">
              {aiSuggestions.trendingSearches.length > 0 && (
                <div className="colleges-search-section">
                  <span className="colleges-search-section-title">✨ Trending</span>
                  <div className="colleges-search-chips">
                    {aiSuggestions.trendingSearches.map(term => (
                      <button key={term} type="button" className="colleges-search-chip" onClick={() => { setQ(term); setSearchFocused(false); }}>{term}</button>
                    ))}
                  </div>
                </div>
              )}
              {aiSuggestions.suggestedQueries.length > 0 && (
                <div className="colleges-search-section">
                  <span className="colleges-search-section-title">Try asking</span>
                  <div className="colleges-search-chips">
                    {aiSuggestions.suggestedQueries.slice(0, 5).map(term => (
                      <button key={term} type="button" className="colleges-search-chip" onClick={() => { setQ(term); setSearchFocused(false); }}>{term}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {isAuthenticated && (
          <label className="scholarship-bookmark-filter">
            <input type="checkbox" checked={bookmarkedOnly} onChange={e => setBookmarkedOnly(e.target.checked)} />
            Show only my bookmarked scholarships
          </label>
        )}

        <div className="colleges-grid-column">
          <div className="card-editorial colleges-toolbar">
            <span className="colleges-toolbar-count">
              {isLoading ? 'Loading…' : `${totalResults} scholarship${totalResults === 1 ? '' : 's'} found`}
            </span>
          </div>

          {isLoading ? (
            <div className="colleges-grid-cards">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="card-editorial colleges-card-skeleton" />)}
            </div>
          ) : scholarships.length === 0 ? (
            <div className="card-editorial colleges-empty-state">
              <div className="colleges-empty-icon">🎓</div>
              <h3 className="font-serif colleges-empty-title">No scholarships found</h3>
              <p className="text-body colleges-empty-desc">Try adjusting your search terms.</p>
            </div>
          ) : (
            <div className="colleges-grid-cards">
              {scholarships.map(s => (
                <div
                  key={s.id || s._id}
                  id={`scholarship-${s.id || s._id}`}
                  style={highlightId === (s.id || s._id) ? { boxShadow: '0 0 0 3px var(--accent-blue)', borderRadius: '12px' } : undefined}
                >
                  <ScholarshipCard
                    scholarship={s}
                    isBookmarked={bookmarkedIds.has(s.id || s._id)}
                    onToggleBookmark={isAuthenticated ? toggleBookmark : undefined}
                  />
                </div>
              ))}
            </div>
          )}

          {!bookmarkedOnly && <Pagination page={page} totalPages={totalPages} onChange={setPage} />}
        </div>
      </div>
    </div>
  );
}

export default function ScholarshipsPage() {
  return (
    <Suspense fallback={<div className="section-padding container-editorial" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <ScholarshipsPageInner />
    </Suspense>
  );
}
