'use client';
import { useEffect, useRef, useState } from 'react';
import { apiClient, ApiError } from '../../lib/api-client';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { PredictorForm } from './components/PredictorForm';
import { ResultCard } from './components/ResultCard';
import { FiltersPanel, type PredictionSortOption } from './components/FiltersPanel';
import { InsightsPanel } from './components/InsightsPanel';
import { CompareDrawer } from './components/CompareDrawer';
import type { PredictCollegesRequest, PredictCollegesResponse, PredictorFilters, RankedCollegeResult } from './types';
import { ReportDownloadButton } from '../../components/ui/ReportDownloadButton';

const MAX_COMPARE = 4;
const compareKey = (result: RankedCollegeResult) => `${result.collegeId}::${result.courseId}`;

export default function PredictionsPage() {
  const [baseRequest, setBaseRequest] = useState<PredictCollegesRequest | null>(null);
  const [filters, setFilters] = useState<PredictorFilters>({});
  const [sortBy, setSortBy] = useState<PredictionSortOption>('nirf');
  const [page, setPage] = useState(1);
  const [retryToken, setRetryToken] = useState(0);

  const [response, setResponse] = useState<PredictCollegesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const requestSequenceRef = useRef(0);
  const debouncedFilters = useDebouncedValue(filters, 450);
  const filtersPending = JSON.stringify(filters) !== JSON.stringify(debouncedFilters);
  const hasTooShortTextFilter = [filters.search, filters.city, filters.district]
    .some(value => Boolean(value?.trim()) && value!.trim().length < 2);

  useEffect(() => {
    if (!baseRequest) return;
    if (hasTooShortTextFilter) {
      setLoading(false);
      setError(null);
      setResponse(null);
      return;
    }
    if (filtersPending) {
      setLoading(true);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const sequence = ++requestSequenceRef.current;
    setLoading(true);
    setError(null);

    apiClient.post<PredictCollegesResponse>('/predictions/colleges', {
      ...baseRequest,
      filters: Object.keys(debouncedFilters).length > 0 ? debouncedFilters : undefined,
      sortBy,
      page,
      limit: 10,
    }, undefined, undefined, controller.signal)
      .then(result => {
        if (!controller.signal.aborted && sequence === requestSequenceRef.current) setResponse(result);
      })
      .catch(err => {
        if (controller.signal.aborted || sequence !== requestSequenceRef.current) return;
        setResponse(null);
        setError(err instanceof ApiError ? err.message : 'Something went wrong computing your predictions. Please try again.');
      })
      .finally(() => {
        if (!controller.signal.aborted && sequence === requestSequenceRef.current) setLoading(false);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseRequest, debouncedFilters, filtersPending, hasTooShortTextFilter, sortBy, page, retryToken]);

  const handlePredict = (request: PredictCollegesRequest) => {
    setPage(1);
    setFilters({});
    setSortBy('nirf');
    setResponse(null);
    setError(null);
    setBaseRequest(request);
  };

  const toggleCompare = (collegeId: string) => {
    setCompareIds(prev =>
      prev.includes(collegeId) ? prev.filter(id => id !== collegeId) : prev.length < MAX_COMPARE ? [...prev, collegeId] : prev,
    );
  };

  const compareResults: RankedCollegeResult[] = (response?.results ?? []).filter(r => compareIds.includes(compareKey(r)));

  // The API sorts the complete filtered result set before pagination. Keep
  // that order rather than re-sorting only the current page in the browser.
  const displayResults = response?.results ?? [];

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
              KCET · COMEDK · NEET Analytics
            </span>
            <h1 className="text-section-title font-serif" style={{ margin: 0 }}>Historical Admission Cutoff Comparison</h1>
          </div>
          <ReportDownloadButton reportType="admission_prediction" tooltip="Download Report" size="md" />
        </div>
        <p className="text-body" style={{ maxWidth: '720px' }}>
          Compare your entrance exam rank with verified, exam-specific historical counselling cutoffs. Results show the source year, round and category; they do not claim statistically calibrated admission probabilities.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: response ? '340px 1fr' : '1fr 1fr', gap: '32px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <PredictorForm onSubmit={handlePredict} loading={loading} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!response && !loading && !error && (
            <div className="card-editorial" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
              <div style={{ fontSize: '48px' }}>🎯</div>
              <h3 className="font-serif" style={{ fontSize: '22px', color: 'var(--text-primary)', margin: 0 }}>Ready to Predict</h3>
              <p className="text-body" style={{ fontSize: '15px', maxWidth: '360px', margin: 0 }}>
                {hasTooShortTextFilter ? 'Type at least 2 characters to filter by college, course or location.' : 'Select your exam and rank on the left to compare against available verified cutoff records.'}
              </p>
            </div>
          )}

          {error && (
            <div className="card-editorial" style={{ padding: '24px', color: '#B3261E' }}>{error}</div>
          )}

          {loading && (
            <div className="card-editorial" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Calculating your admission probabilities…
            </div>
          )}

          {response && !loading && (
            <>
              {/* Horizontal Filter Bar Positioned Above Details */}
              <FiltersPanel
                examCode={baseRequest?.examCode ?? 'KCET'}
                filters={filters}
                onChange={f => { setPage(1); setFilters(f); }}
                sortBy={sortBy}
                onSortByChange={s => { setPage(1); setSortBy(s); }}
              />

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

              {displayResults.length === 0 ? (
                <div className="card-editorial" style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                  <div style={{ fontSize: '36px' }}>🔍</div>
                  <h3 className="font-serif" style={{ fontSize: '20px', color: 'var(--text-primary)', margin: 0 }}>No colleges match your selected filters.</h3>
                  <p style={{ fontSize: '14px', margin: 0 }}>Try clearing some of your filters or broadening your course selections.</p>
                  <button
                    type="button"
                    onClick={() => { setFilters({}); setSortBy('nirf'); setPage(1); }}
                    className="btn-editorial-primary"
                    style={{ padding: '8px 20px', fontSize: '13px', borderRadius: '999px' }}
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                displayResults.map(result => (
                  <ResultCard
                    key={`${result.collegeId}-${result.courseId}`}
                    result={result}
                    selected={compareIds.includes(compareKey(result))}
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
