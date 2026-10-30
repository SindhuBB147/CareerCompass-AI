'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { useSpeechRecognition } from '../../hooks/useSpeechRecognition';
import { searchApi, type SearchFilters, type SearchResponse } from '../../lib/search-api';
import { readCompareIds, toggleCompareId, clearCompareIds, MAX_COMPARE } from '../../lib/colleges-storage';
import { CompareBar } from '../../components/colleges/CompareBar';
import { SearchCollegeCard } from './components/SearchCollegeCard';
import { AiResponsePanel } from './components/AiResponsePanel';
import { SearchHistoryPanel } from './components/SearchHistoryPanel';
import { SearchFilterBar } from './components/SearchFilterBar';

function SignInPrompt() {
  return (
    <div className="card-editorial colleges-empty-state">
      <div className="colleges-empty-icon">✨</div>
      <h3 className="font-serif colleges-empty-title">Sign In for AI Smart Search</h3>
      <p className="text-body colleges-empty-desc">
        Smart Search personalizes results from your exam rank, category, budget, and preferences — sign in to use it.
      </p>
      <a href="/login/student" className="btn-editorial-primary" style={{ textDecoration: 'none' }}>Student Login</a>
    </div>
  );
}

function formatDeadline(dateStr: string): string {
  try { return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

function SearchPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, accessToken, isLoading: authLoading } = useUserAuth();

  const [inputValue, setInputValue] = useState(searchParams.get('q') ?? '');
  const [submittedQuery, setSubmittedQuery] = useState(searchParams.get('q') ?? '');
  const [filters, setFilters] = useState<SearchFilters>({});
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const { listening, speechSupported, toggleListening } = useSpeechRecognition({
    onResult: (transcript) => { setInputValue(transcript); runSearch(transcript); },
  });

  useEffect(() => { setCompareIds(readCompareIds()); }, []);

  const runSearch = useCallback((query: string) => {
    const q = query.trim();
    if (!q) return;
    setSubmittedQuery(q);
    router.replace(`/search?q=${encodeURIComponent(q)}`);
  }, [router]);

  useEffect(() => {
    if (!submittedQuery.trim() || !accessToken) { setResults(null); return; }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    searchApi.search(accessToken, submittedQuery, filters)
      .then((res) => { if (!cancelled) { setResults(res); setHistoryRefreshKey((k) => k + 1); } })
      .catch(() => { if (!cancelled) setError('Something went wrong running that search. Please try again.'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedQuery, accessToken, filters.city, filters.collegeType, filters.maxFee, filters.maxNirf, filters.hostelAvailable]);

  const handleToggleCompare = useCallback((id: string) => setCompareIds(toggleCompareId(id)), []);

  if (authLoading) return null;
  if (!isAuthenticated || !accessToken) {
    return <div className="section-padding container-editorial"><SignInPrompt /></div>;
  }

  return (
    <div className="colleges-page smart-search-page">
      <section className="colleges-hero smart-search-hero">
        <div className="container-editorial colleges-hero-inner">
          <span className="colleges-hero-eyebrow">AI Smart Search</span>
          <h1 className="text-section-title font-serif colleges-hero-title">Ask, and find your best-fit colleges</h1>
          <p className="text-body colleges-hero-subtitle">
            Natural language search across colleges, scholarships, admission chances, and financial planning — personalized to your profile.
          </p>

          <form
            className="smart-search-page-bar"
            role="search"
            onSubmit={(e) => { e.preventDefault(); runSearch(inputValue); }}
          >
            <span className="colleges-search-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="e.g. Best CSE colleges under ₹2 lakh with hostel"
              aria-label="AI Smart Search query"
              className="input-editorial colleges-search-input"
            />
            {speechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className="smart-search-mic"
                aria-label={listening ? 'Stop voice search' : 'Search by voice'}
                style={{ color: listening ? 'var(--accent-blue)' : undefined }}
              >
                {listening ? '●' : '🎤'}
              </button>
            )}
            <button type="submit" className="btn-editorial-primary">Search</button>
          </form>
        </div>
      </section>

      <div className="container-editorial colleges-content smart-search-content">
        {!submittedQuery.trim() && (
          <div className="card-editorial colleges-empty-state">
            <div className="colleges-empty-icon">✨</div>
            <h3 className="font-serif colleges-empty-title">Ask anything about admissions</h3>
            <p className="text-body colleges-empty-desc">Try "Government engineering colleges in Bangalore" or "Scholarships for SC students".</p>
          </div>
        )}

        {isLoading && (
          <div className="colleges-grid-cards" aria-busy="true" aria-label="Searching">
            {[1, 2, 3].map((i) => <div key={i} className="card-editorial colleges-card-skeleton" />)}
          </div>
        )}

        {error && !isLoading && (
          <div className="card-editorial colleges-empty-state">
            <h3 className="font-serif colleges-empty-title">Search failed</h3>
            <p className="text-body colleges-empty-desc">{error}</p>
          </div>
        )}

        {!isLoading && !error && results && (
          <div className="smart-search-layout">
            <div className="smart-search-main">
              <SearchFilterBar filters={filters} onChange={setFilters} />
              <AiResponsePanel token={accessToken} query={submittedQuery} onPickFollowUp={(q) => { setInputValue(q); runSearch(q); }} />

              {results.colleges.length === 0 && results.scholarships.length === 0 ? (
                <div className="card-editorial colleges-empty-state">
                  <div className="colleges-empty-icon">🔍</div>
                  <h3 className="font-serif colleges-empty-title">No exact matches</h3>
                  <p className="text-body colleges-empty-desc">
                    We couldn't find results matching every part of that query. Try removing a filter, or broadening your budget, location, or course.
                  </p>
                </div>
              ) : (
                <>
                  {results.colleges.length > 0 && (
                    <section>
                      <h2 className="font-serif smart-search-section-title">Colleges ({results.colleges.length})</h2>
                      <div className="colleges-grid-cards">
                        {results.colleges.map((card) => (
                          <SearchCollegeCard
                            key={card.id}
                            card={card}
                            isComparing={compareIds.includes(card.id)}
                            onToggleCompare={handleToggleCompare}
                            compareDisabled={compareIds.length >= MAX_COMPARE}
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {results.scholarships.length > 0 && (
                    <section className="smart-search-scholarships-section">
                      <h2 className="font-serif smart-search-section-title">Scholarships ({results.scholarships.length})</h2>
                      <div className="smart-search-scholarship-list">
                        {results.scholarships.map((s) => (
                          <a key={s.id} href={`/scholarships/${s.id}`} className="card-editorial smart-search-scholarship-card">
                            <strong>{s.name}</strong>
                            <span className="colleges-badge-editorial-sm">{s.provider}</span>
                            <span className="smart-search-scholarship-deadline">Deadline: {formatDeadline(s.applicationDeadline)}</span>
                          </a>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              )}

              {results.suggestedFollowUps.length > 0 && (
                <div className="smart-search-followups">
                  <span className="smart-search-followups-label">Follow-up questions</span>
                  <div className="colleges-search-chips">
                    {results.suggestedFollowUps.map((q) => (
                      <button key={q} type="button" className="colleges-search-chip" onClick={() => { setInputValue(q); runSearch(q); }}>{q}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <SearchHistoryPanel
              token={accessToken}
              currentHistoryId={results.historyId}
              onPick={(q) => { setInputValue(q); runSearch(q); }}
              refreshKey={historyRefreshKey}
            />
          </div>
        )}
      </div>

      <CompareBar compareIds={compareIds} onClear={() => setCompareIds(clearCompareIds())} />
    </div>
  );
}

export default function SmartSearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}
