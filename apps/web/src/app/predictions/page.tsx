'use client';
import { useEffect, useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { PredictorForm } from './components/PredictorForm';
import { ResultCard } from './components/ResultCard';
import { FiltersPanel } from './components/FiltersPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { CompareDrawer } from './components/CompareDrawer';
import type { PredictCollegesRequest, PredictCollegesResponse, PredictorFilters, RankedCollegeResult } from './types';

const MAX_COMPARE = 4;

export default function PredictionsPage() {
  const [baseRequest, setBaseRequest] = useState<PredictCollegesRequest | null>(null);
  const [filters, setFilters] = useState<PredictorFilters>({});
  const [sortBy, setSortBy] = useState<'nirf' | 'probability'>('nirf');
  const [page, setPage] = useState(1);

  const [response, setResponse] = useState<PredictCollegesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  useEffect(() => {
    if (!baseRequest) return;
    setLoading(true);
    setError(null);

    apiClient.post<PredictCollegesResponse>('/predictions/colleges', {
      ...baseRequest,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      sortBy,
      page,
      limit: 10,
    })
      .then(setResponse)
      .catch(err => {
        setResponse(null);
        setError(err instanceof ApiError ? err.message : 'Something went wrong computing your predictions. Please try again.');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRequest, filters, sortBy, page]);

  const handlePredict = (request: PredictCollegesRequest) => {
    setPage(1);
    setBaseRequest(request);
  };

  const toggleCompare = (collegeId: string) => {
    setCompareIds(prev =>
      prev.includes(collegeId) ? prev.filter(id => id !== collegeId) : prev.length < MAX_COMPARE ? [...prev, collegeId] : prev,
    );
  };

  const compareResults: RankedCollegeResult[] = (response?.results ?? []).filter(r => compareIds.includes(r.collegeId));

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
          KCET · COMEDK · NEET Analytics
        </span>
        <h1 className="text-section-title font-serif">Cutoff & Recommendation Engine</h1>
        <p className="text-body" style={{ maxWidth: '720px' }}>
          Calculate recommendations and expected closing ranks across Karnataka's engineering, medical, and professional colleges using
          trend-weighted multi-year closing rank modeling — ranked by NIRF, then by recommendation fit.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: response ? '340px 1fr' : '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PredictorForm onSubmit={handlePredict} loading={loading} />
          {response && (
            <FiltersPanel filters={filters} onChange={f => { setPage(1); setFilters(f); }} sortBy={sortBy} onSortByChange={s => { setPage(1); setSortBy(s); }} />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!response && !loading && !error && (
            <div className="card-editorial" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '48px' }}>🎯</div>
              <h3 className="font-serif" style={{ fontSize: '22px', color: 'var(--text-primary)', margin: 0 }}>Ready to Predict</h3>
              <p className="text-body" style={{ fontSize: '15px', maxWidth: '360px', margin: 0 }}>
                Select your exam and enter your details on the left to compute real-time, college-ranked recommendations.
              </p>
            </div>
          )}

          {error && (
            <div className="card-editorial" style={{ padding: '24px', color: '#B3261E' }}>{error}</div>
          )}

          {loading && (
            <div className="card-editorial" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating recommendations and cutoff predictions…
            </div>
          )}

          {response && !loading && (
            <>
              <InsightsPanel insights={response.insights} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                  {response.totalResults} college{response.totalResults === 1 ? '' : 's'} matched
                </span>
                {compareIds.length > 0 && (
                  <button onClick={() => setShowCompare(true)} className="btn-editorial-secondary" style={{ padding: '8px 20px', fontSize: '13px' }}>
                    Compare ({compareIds.length}) →
                  </button>
                )}
              </div>

              {response.results.length === 0 ? (
                <div className="card-editorial" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  No colleges matched your selections. Try widening your course preferences or clearing filters.
                </div>
              ) : (
                response.results.map(result => (
                  <ResultCard
                    key={`${result.collegeId}-${result.courseId}`}
                    result={result}
                    selected={compareIds.includes(result.collegeId)}
                    onToggleCompare={toggleCompare}
                    compareDisabled={compareIds.length >= MAX_COMPARE}
                  />
                ))
              )}

              {response.totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', paddingTop: '12px' }}>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="btn-editorial-secondary"
                    style={{ padding: '8px 20px', fontSize: '13px', opacity: page <= 1 ? 0.5 : 1 }}
                  >
                    ← Previous
                  </button>
                  <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
                    Page {response.page} of {response.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(response.totalPages, p + 1))}
                    disabled={page >= response.totalPages}
                    className="btn-editorial-secondary"
                    style={{ padding: '8px 20px', fontSize: '13px', opacity: page >= response.totalPages ? 0.5 : 1 }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCompare && (
        <CompareDrawer
          selected={compareResults}
          onClose={() => setShowCompare(false)}
          onRemove={id => setCompareIds(prev => prev.filter(c => c !== id))}
        />
      )}
    </div>
  );
}
