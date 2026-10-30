'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  collegesApi,
  type College,
  type CutoffRow,
  type CutoffFacetsResult,
  type CutoffSummaryResult,
  type CutoffAIInsightsResult,
} from '../../lib/colleges-api';

interface CollegeCutoffsSectionProps {
  college: College;
}

const CATEGORY_TOOLTIPS: Record<string, string> = {
  GM: 'General Merit — Open competition category for all eligible candidates.',
  GMK: 'General Merit (Kannada Medium) — Reservation for students educated in Kannada medium.',
  GMR: 'General Merit (Rural) — Reservation for students educated in rural Karnataka schools.',
  '1G': 'Category 1 General — Backward Category 1 general seats.',
  '1K': 'Category 1 (Kannada Medium) — Category 1 Kannada medium quota.',
  '1R': 'Category 1 (Rural) — Category 1 rural school quota.',
  '2AG': 'Category 2A General — Backward Category 2A general seats.',
  '2AK': 'Category 2A (Kannada Medium) — Category 2A Kannada medium quota.',
  '2AR': 'Category 2A (Rural) — Category 2A rural school quota.',
  '2BG': 'Category 2B General — Backward Category 2B general seats.',
  '2BK': 'Category 2B (Kannada Medium) — Category 2B Kannada medium quota.',
  '2BR': 'Category 2B (Rural) — Category 2B rural school quota.',
  '3AG': 'Category 3A General — Backward Category 3A general seats.',
  '3AK': 'Category 3A (Kannada Medium) — Category 3A Kannada medium quota.',
  '3AR': 'Category 3A (Rural) — Category 3A rural school quota.',
  '3BG': 'Category 3B General — Backward Category 3B general seats.',
  '3BK': 'Category 3B (Kannada Medium) — Category 3B Kannada medium quota.',
  '3BR': 'Category 3B (Rural) — Category 3B rural school quota.',
  SCG: 'Scheduled Caste General — Reserved seats for Scheduled Caste candidates.',
  SCK: 'Scheduled Caste (Kannada Medium) — SC Kannada medium quota.',
  SCR: 'Scheduled Caste (Rural) — SC rural school quota.',
  STG: 'Scheduled Tribe General — Reserved seats for Scheduled Tribe candidates.',
  STK: 'Scheduled Tribe (Kannada Medium) — ST Kannada medium quota.',
  STR: 'Scheduled Tribe (Rural) — ST rural school quota.',
  EWS: 'Economically Weaker Section — 10% reservation for General category EWS candidates.',
  PwD: 'Persons with Disabilities — Special reservation for physically challenged candidates.',
  HK: 'Hyderabad-Karnataka (Kalyana Karnataka) — Article 371(J) local cadre reservation.',
  RK: 'Rural Karnataka — Quota for candidates who studied 10 years in rural Karnataka.',
  SNQ: 'Supernumerary Quota — Tuition fee waiver seats for high rankers based on income.',
  OBC: 'Other Backward Classes — Central/State OBC quota.',
};

const ROUND_TOOLTIPS: Record<string, string> = {
  '1': 'Round 1 — Initial counselling allotment round.',
  '2': 'Round 2 — Second allotment round for vacant seats.',
  '3': 'Mop-Up Round — Final counselling round for remaining unallotted seats.',
  '4': 'Extended Mop-Up / Special Round — Final institution allotment round.',
};

const ROUND_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  '1': { bg: 'rgba(45,110,163,0.10)', color: '#2D6EA3', border: 'rgba(45,110,163,0.25)' },
  '2': { bg: 'rgba(29,122,70,0.10)',  color: '#1D7A46', border: 'rgba(29,122,70,0.25)'  },
  '3': { bg: 'rgba(154,107,0,0.10)',  color: '#9A6B00', border: 'rgba(154,107,0,0.25)'  },
  '4': { bg: 'rgba(120,60,150,0.10)', color: '#7B3FA0', border: 'rgba(120,60,150,0.25)' },
};

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  GM:  { bg: 'rgba(17,17,17,0.07)',   color: 'var(--text-primary)' },
  GMK: { bg: 'rgba(17,17,17,0.07)',   color: 'var(--text-primary)' },
  SCG: { bg: 'rgba(100,50,160,0.10)', color: '#6432A0'             },
  STG: { bg: 'rgba(140,70,30,0.10)',  color: '#8C461E'             },
  EWS: { bg: 'rgba(29,122,70,0.10)',  color: '#1D7A46'             },
  HK:  { bg: 'rgba(45,80,163,0.10)',  color: '#2D50A3'             },
  SNQ: { bg: 'rgba(0,140,140,0.10)',  color: '#007D7D'             },
  PwD: { bg: 'rgba(180,35,46,0.10)',  color: '#B4232E'             },
  OBC: { bg: 'rgba(200,100,0,0.10)',  color: '#C86400'             },
};

const LEGEND_CATS = ['GM', 'GMK', 'HK', 'RK', 'SNQ', 'EWS', 'PwD', '2AG', 'SCG', 'STG'];

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function TableSkeleton() {
  return (
    <div style={{ borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg-main)', padding: '14px 20px', display: 'flex', gap: 32 }}>
        {['160px','120px','220px','80px','90px','110px','120px'].map((w, i) => (
          <div key={i} style={{ height: 14, width: w, borderRadius: 7, background: 'linear-gradient(90deg,var(--border-color) 25%,#e8e8e8 50%,var(--border-color) 75%)', backgroundSize: '400% 100%', animation: 'cutoffShimmer 1.4s ease infinite' }} />
        ))}
      </div>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: 32, background: i % 2 !== 0 ? 'var(--bg-main)' : 'transparent', opacity: 1 - i * 0.08 }}>
          {['80px','90px','200px','64px','80px','90px','100px'].map((w, j) => (
            <div key={j} style={{ height: 13, width: w, borderRadius: 6, background: 'linear-gradient(90deg,var(--border-color) 25%,#e8e8e8 50%,var(--border-color) 75%)', backgroundSize: '400% 100%', animation: `cutoffShimmer 1.4s ${j * 0.1}s ease infinite` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function RoundBadge({ round }: { round: number }) {
  const s = ROUND_STYLES[String(round)] || { bg: 'var(--bg-main)', color: 'var(--text-secondary)', border: 'var(--border-color)' };
  return (
    <span title={ROUND_TOOLTIPS[String(round)] || `Round ${round}`}
      style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      R{round}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const s = CATEGORY_STYLES[category] || { bg: 'rgba(17,17,17,0.07)', color: 'var(--text-secondary)' };
  return (
    <span title={CATEGORY_TOOLTIPS[category] || category}
      style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, cursor: 'help', whiteSpace: 'nowrap' }}>
      {category}
    </span>
  );
}

function MetricCard({ icon, label, value, accent }: { icon: string; label: string; value: string; accent?: string }) {
  return (
    <div style={{ background: 'var(--bg-surface,#fff)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column' as const, gap: 6, position: 'relative' as const, overflow: 'hidden', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
      className="cutoff-metric-card">
      <div style={{ position: 'absolute' as const, top: 0, right: 0, width: 56, height: 56, borderRadius: '0 16px 0 56px', background: accent ? `${accent}18` : 'var(--bg-main)', pointerEvents: 'none' as const }} />
      <span style={{ fontSize: 18, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color: accent || 'var(--text-primary)', fontFamily: 'var(--font-heading)', lineHeight: 1.2 }}>{value}</span>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 13px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: active ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)', background: active ? 'rgba(45,110,163,0.09)' : 'var(--bg-surface,#fff)', color: active ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s ease', whiteSpace: 'nowrap' as const, boxShadow: active ? '0 0 0 3px rgba(45,110,163,0.09)' : 'none' }}>
      {active && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-blue)', display: 'inline-block' }} />}
      {label}
    </button>
  );
}

function SortIndicator({ field, sortBy, sortOrder }: { field: string; sortBy: string; sortOrder: 'asc' | 'desc' }) {
  if (sortBy !== field) return <span style={{ color: 'var(--text-muted)', marginLeft: 3, fontSize: 9 }}>⇅</span>;
  return <span style={{ color: 'var(--accent-blue)', marginLeft: 3, fontSize: 9 }}>{sortOrder === 'asc' ? '↑' : '↓'}</span>;
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export function CollegeCutoffsSection({ college }: CollegeCutoffsSectionProps) {
  const collegeId = college.id || college._id;

  const collegeExams = useMemo(() => {
    const exams = new Set<string>();
    for (const c of college.courses || []) {
      for (const e of c.examsAccepted || []) exams.add(e.toUpperCase());
    }
    if (exams.size === 0) exams.add('KCET');
    return Array.from(exams);
  }, [college]);

  const [activeExam, setActiveExam]         = useState<string>(collegeExams[0] || 'KCET');
  const [activeViewTab, setActiveViewTab]   = useState<'table' | 'trends' | 'insights'>('table');
  const [selectedYear, setSelectedYear]     = useState<string>('');
  const [selectedRound, setSelectedRound]   = useState<string>('');
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('GM');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery]       = useState<string>('');
  const [sortBy, setSortBy]                 = useState<string>('closingRank');
  const [sortOrder, setSortOrder]           = useState<'asc' | 'desc'>('asc');
  const [page, setPage]                     = useState<number>(1);
  const [filtersOpen, setFiltersOpen]       = useState<boolean>(true);
  const [insightsOpen, setInsightsOpen]     = useState<boolean>(true);
  const [activeTooltip, setActiveTooltip]   = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const [facets, setFacets]         = useState<CutoffFacetsResult | null>(null);
  const [summary, setSummary]       = useState<CutoffSummaryResult | null>(null);
  const [cutoffRows, setCutoffRows] = useState<CutoffRow[]>([]);
  const [totalRows, setTotalRows]   = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [aiInsights, setAiInsights] = useState<CutoffAIInsightsResult | null>(null);
  const [isLoading, setIsLoading]   = useState<boolean>(true);

  useEffect(() => {
    if (!collegeId || !activeExam) return;
    let cancelled = false;
    collegesApi.getCutoffFacets(collegeId, activeExam).then((r) => { if (!cancelled) setFacets(r); }).catch(() => setFacets(null));
    collegesApi.getCutoffSummary(collegeId, activeExam).then((r) => { if (!cancelled) setSummary(r); }).catch(() => setSummary(null));
    return () => { cancelled = true; };
  }, [collegeId, activeExam]);

  useEffect(() => {
    if (!collegeId || !activeExam) return;
    let cancelled = false;
    setIsLoading(true);
    collegesApi.getCutoffs(collegeId, {
      examCode: activeExam,
      year: selectedYear ? Number(selectedYear) : undefined,
      round: selectedRound ? Number(selectedRound) : undefined,
      courseId: selectedCourse || undefined,
      category: selectedCategory || undefined,
      branch: selectedBranch || undefined,
      search: searchQuery || undefined,
      page, limit: 25, sortBy, sortOrder,
    }).then((res) => {
      if (cancelled) return;
      setCutoffRows(res.results); setTotalRows(res.total); setTotalPages(res.totalPages);
    }).catch(() => {
      if (cancelled) return;
      setCutoffRows([]); setTotalRows(0); setTotalPages(1);
    }).finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [collegeId, activeExam, selectedYear, selectedRound, selectedCourse, selectedCategory, selectedBranch, searchQuery, sortBy, sortOrder, page]);

  useEffect(() => {
    if (!collegeId || !activeExam) return;
    let cancelled = false;
    collegesApi.getCutoffAIInsights(collegeId, selectedCourse || undefined, activeExam, selectedCategory || 'GM')
      .then((r) => { if (!cancelled) setAiInsights(r); }).catch(() => setAiInsights(null));
    return () => { cancelled = true; };
  }, [collegeId, activeExam, selectedCourse, selectedCategory]);

  const resetFilters = () => {
    setSelectedYear(''); setSelectedRound(''); setSelectedCourse('');
    setSelectedCategory('GM'); setSelectedBranch('');
    setSearchQuery(''); setPage(1);
  };

  const handleExportPdf = () => {
    setIsExportingPdf(true);
    try {
      const pdfUrl = collegesApi.getCutoffPdfUrl(collegeId, {
        examCode: activeExam,
        year: selectedYear ? Number(selectedYear) : undefined,
        round: selectedRound ? Number(selectedRound) : undefined,
        courseId: selectedCourse || undefined,
        category: selectedCategory || undefined,
        branch: selectedBranch || undefined,
        search: searchQuery || undefined,
        sortBy, sortOrder,
      });
      const link = document.createElement('a');
      link.href = pdfUrl; link.target = '_blank';
      const yr = selectedYear || summary?.latestAcademicYear ? `${selectedYear || summary?.latestAcademicYear}` : 'Report';
      const col = (college.collegeId || college.id || 'College').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `${col}_${activeExam}_Cutoff_${yr}.pdf`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    } catch { window.print(); }
    finally { setTimeout(() => setIsExportingPdf(false), 1200); }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortOrder('asc'); }
    setPage(1);
  };

  const dynamicExtraColumns = useMemo(() => {
    // openingRank/seatsAvailable/remarks/admissionCode are retired fields — kept here (rather
    // than dropped) so any legacy record that still has them stored doesn't resurface them as
    // an auto-detected "extra" column.
    const known = new Set(['_id','id','collegeId','courseId','courseName','examCode','year','round','category','quota','branch','closingRank','source','lastUpdated','createdAt','updatedAt','openingRank','seatsAvailable','remarks','admissionCode','status','verifiedBy','metadata','__v']);
    const extra = new Set<string>();
    for (const row of cutoffRows) for (const k of Object.keys(row)) if (!known.has(k) && row[k] != null) extra.add(k);
    return Array.from(extra);
  }, [cutoffRows]);

  const availableYears  = facets?.years?.slice(0, 5) || [];
  const availableRounds = facets?.rounds?.slice(0, 4) || [];
  const availableCats   = facets?.categories?.slice(0, 8) || ['GM', '2AG', '3AG', 'SCG', 'STG', 'EWS', 'HK', 'SNQ'];
  const activeFilterCount = [selectedYear, selectedRound, selectedCourse, selectedCategory !== 'GM' ? selectedCategory : '', selectedBranch, searchQuery].filter(Boolean).length;

  return (
    <section id="cutoffs" className="card-editorial colleges-section-block"
      aria-label="College Cutoff Data"
      style={{ marginTop: '2rem', padding: 0, overflow: 'hidden', gap: 0, borderRadius: 24 }}>
      <style>{`
        @keyframes cutoffShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes cutoffFadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .cutoff-metric-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.08)!important; }
        .cutoff-th-sort:hover { color:var(--accent-blue)!important; background:rgba(45,110,163,0.04)!important; }
        .cutoff-row:hover td { background:rgba(45,110,163,0.04)!important; }
        .cutoff-action-btn:hover { border-color:var(--accent-blue)!important; color:var(--accent-blue)!important; }
        @media(max-width:640px){
          .cutoff-table-desktop{display:none!important;}
          .cutoff-mobile-cards{display:flex!important;}
          .cutoff-header-stats{display:none!important;}
          .cutoff-filters-grid{grid-template-columns:1fr 1fr!important;}
        }
        @media(min-width:641px){.cutoff-mobile-cards{display:none!important;}}
        @media(max-width:480px){.cutoff-filters-grid{grid-template-columns:1fr!important;}}
        .cutoff-filter-select{
          width:100%;padding:8px 30px 8px 11px;font-size:13px;border-radius:10px;
          border:1px solid var(--border-color);background:var(--bg-surface,#fff);
          color:var(--text-primary);font-family:var(--font-body);outline:none;
          transition:border-color 0.18s ease,box-shadow 0.18s ease;
          appearance:none;-webkit-appearance:none;
          background-image:url("data:image/svg+xml,%3Csvg width='10' height='6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23777' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
          background-repeat:no-repeat;background-position:right 10px center;
        }
        .cutoff-filter-select:focus{border-color:var(--accent-blue);box-shadow:0 0 0 3px rgba(45,110,163,0.11);}
        .cutoff-search{
          width:100%;padding:8px 11px 8px 32px;font-size:13px;border-radius:10px;
          border:1px solid var(--border-color);background:var(--bg-surface,#fff);
          color:var(--text-primary);font-family:var(--font-body);outline:none;
          transition:border-color 0.18s ease,box-shadow 0.18s ease;
        }
        .cutoff-search:focus{border-color:var(--accent-blue);box-shadow:0 0 0 3px rgba(45,110,163,0.11);}
      `}</style>

      {/* Top accent bar */}
      <div style={{ height: 4, background: 'linear-gradient(90deg,#1E3A5F 0%,var(--accent-blue) 50%,#5B9FD4 100%)' }} />

      {/* Header */}
      <div style={{ padding: '26px 28px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14, marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h2 className="font-serif" style={{ margin: 0, fontSize: 'clamp(19px,2.8vw,25px)', borderBottom: 'none', paddingBottom: 0 }}>
                📈 Previous Year Cutoffs
              </h2>
              <span style={{ padding: '3px 10px', borderRadius: 999, background: 'rgba(45,110,163,0.10)', color: 'var(--accent-blue)', fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
                Live Dataset
              </span>
            </div>
            <p style={{ margin: '5px 0 0', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 520 }}>
              Explore historical opening and closing ranks across multiple entrance exams, rounds, categories and academic years.
            </p>
          </div>
          {/* Header stat chips */}
          <div className="cutoff-header-stats" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Latest Year', val: summary?.latestAcademicYear ? String(summary.latestAcademicYear) : null },
              { label: 'Courses', val: summary?.totalCourses != null ? String(summary.totalCourses) : null },
              { label: 'Records', val: totalRows > 0 ? totalRows.toLocaleString() : null },
            ].filter(x => x.val).map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'center', padding: '7px 15px', borderRadius: 12, background: 'var(--bg-main,#F8F8F6)', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Exam tabs */}
        <div role="tablist" aria-label="Select Entrance Exam" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {collegeExams.map((exam) => {
            const active = activeExam === exam;
            return (
              <button key={exam} role="tab" aria-selected={active} type="button"
                onClick={() => { setActiveExam(exam); setPage(1); setSelectedRound(''); setSelectedCourse(''); setSelectedYear(''); }}
                style={{ padding: '9px 20px', fontSize: 13, fontWeight: 700, borderRadius: '12px 12px 0 0', border: '1px solid var(--border-color)', borderBottom: active ? '1px solid var(--bg-surface,#fff)' : '1px solid var(--border-color)', background: active ? 'var(--bg-surface,#fff)' : 'var(--bg-main,#F8F8F6)', color: active ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s ease', position: 'relative' as const, zIndex: active ? 1 : 0, transform: active ? 'translateY(1px)' : 'none', letterSpacing: '0.04em' }}>
                {exam}
                {active && <span style={{ marginLeft: 6, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-blue)', display: 'inline-block', verticalAlign: 'middle' }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Panel body */}
      <div style={{ border: '1px solid var(--border-color)', borderTop: 'none', borderRadius: '0 16px 16px 16px', margin: '0 8px 8px', padding: '22px 22px 0' }}>

        {/* Summary metric cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10, marginBottom: 20, animation: 'cutoffFadeIn 0.35s ease' }}>
          {isLoading && !summary ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ height: 90, borderRadius: 16, background: 'linear-gradient(90deg,var(--border-color) 25%,#e8e8e8 50%,var(--border-color) 75%)', backgroundSize: '400% 100%', animation: 'cutoffShimmer 1.4s ease infinite', border: '1px solid var(--border-color)' }} />
            ))
          ) : (
            <>
              <MetricCard icon="🎓" label="Exam"          value={activeExam}                                                                    accent="var(--accent-blue)" />
              <MetricCard icon="📅" label="Latest Year"   value={summary?.latestAcademicYear ? String(summary.latestAcademicYear) : '—'}         accent="#2D6EA3" />
              <MetricCard icon="🏆" label="Latest Round"  value={summary?.latestRound ? `Round ${summary.latestRound}` : '—'}                    accent="#9A6B00" />
              <MetricCard icon="🎯" label="Lowest Rank"   value={summary?.lowestClosingRank  ? `#${summary.lowestClosingRank.toLocaleString()}`  : '—'} accent="#1D7A46" />
              <MetricCard icon="📈" label="Highest Rank"  value={summary?.highestClosingRank ? `#${summary.highestClosingRank.toLocaleString()}` : '—'} accent="#B4232E" />
              <MetricCard icon="🏫" label="Courses"       value={summary?.totalCourses != null ? String(summary.totalCourses) : '—'} />
            </>
          )}
        </div>

        {/* View tabs + actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, borderBottom: '1px solid var(--border-color)', marginBottom: 18 }}>
          <div role="tablist" style={{ display: 'flex', gap: 2 }}>
            {([['table','📋',`Records (${totalRows})`], ['trends','📊','Trend Charts'], ['insights','🤖','AI Insights']] as const).map(([tab, icon, label]) => {
              const active = activeViewTab === tab;
              return (
                <button key={tab} role="tab" aria-selected={active} type="button" onClick={() => setActiveViewTab(tab)}
                  style={{ background: 'none', border: 'none', borderBottom: active ? '2.5px solid var(--accent-blue)' : '2.5px solid transparent', padding: '9px 15px', fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.18s ease', borderRadius: '8px 8px 0 0' }}>
                  {icon} {label}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button type="button" onClick={handleExportPdf} disabled={isExportingPdf} aria-label="Download PDF"
              className="cutoff-action-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 15px', borderRadius: 10, fontSize: 12, fontWeight: 700, border: '1px solid var(--border-color)', background: 'var(--bg-main,#F8F8F6)', color: 'var(--text-primary)', cursor: isExportingPdf ? 'not-allowed' : 'pointer', opacity: isExportingPdf ? 0.6 : 1, transition: 'all 0.18s ease' }}>
              📄 {isExportingPdf ? 'Generating…' : 'PDF'}
            </button>
            <button type="button" onClick={() => window.print()} aria-label="Print"
              className="cutoff-action-btn"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, fontSize: 13, border: '1px solid var(--border-color)', background: 'var(--bg-main,#F8F8F6)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.18s ease' }}>
              🖨️
            </button>
          </div>
        </div>

        {/* Filters panel */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: filtersOpen ? 10 : 0 }}>
            <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen}
              style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', padding: '3px 0', color: 'var(--text-primary)', fontWeight: 700, fontSize: 13 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 6, background: 'var(--bg-main)', border: '1px solid var(--border-color)', fontSize: 9, transition: 'transform 0.18s ease', transform: filtersOpen ? 'rotate(90deg)' : 'none' }}>▶</span>
              🔍 Filters
              {activeFilterCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, borderRadius: '50%', background: 'var(--accent-blue)', color: '#fff', fontSize: 10, fontWeight: 800 }}>{activeFilterCount}</span>
              )}
            </button>
            {activeFilterCount > 0 && (
              <button type="button" onClick={resetFilters} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--accent-blue)', fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
                ✕ Clear All
              </button>
            )}
          </div>
          {filtersOpen && (
            <div className="cutoff-filters-grid"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(155px,1fr))', gap: 9, padding: 13, background: 'var(--bg-main,#F8F8F6)', borderRadius: 12, border: '1px solid var(--border-color)', animation: 'cutoffFadeIn 0.18s ease' }}>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Academic Year</label>
                <select value={selectedYear} onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }} className="cutoff-filter-select">
                  <option value="">All Years</option>
                  {facets?.years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Round</label>
                <select value={selectedRound} onChange={(e) => { setSelectedRound(e.target.value); setPage(1); }} className="cutoff-filter-select">
                  <option value="">All Rounds</option>
                  {facets?.rounds.map((r) => <option key={r} value={r}>Round {r}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Course</label>
                <select value={selectedCourse} onChange={(e) => { setSelectedCourse(e.target.value); setPage(1); }} className="cutoff-filter-select">
                  <option value="">All Courses</option>
                  {college.courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.name} ({c.courseId})</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Category</label>
                <select value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }} className="cutoff-filter-select">
                  <option value="">All Categories</option>
                  {(facets?.categories || ['GM','2AG','3AG','SCG','STG','EWS']).map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div style={{ position: 'relative' as const }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 4 }}>Search Course</label>
                <span style={{ position: 'absolute' as const, left: 10, bottom: 9, color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' as const }}>🔍</span>
                <input type="search" placeholder="e.g. Computer Science…" value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                  aria-label="Search courses" className="cutoff-search" />
              </div>
            </div>
          )}
        </div>

        {/* Quick filter chips */}
        {(availableYears.length > 0 || availableRounds.length > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            {availableYears.map((y) => (
              <FilterChip key={`y${y}`} label={String(y)} active={selectedYear === String(y)}
                onClick={() => { setSelectedYear(selectedYear === String(y) ? '' : String(y)); setPage(1); }} />
            ))}
            {availableYears.length > 0 && availableRounds.length > 0 && <span style={{ width: 1, height: 22, background: 'var(--border-color)', alignSelf: 'center' }} />}
            {availableRounds.map((r) => (
              <FilterChip key={`r${r}`} label={`Round ${r}`} active={selectedRound === String(r)}
                onClick={() => { setSelectedRound(selectedRound === String(r) ? '' : String(r)); setPage(1); }} />
            ))}
            {availableCats.length > 0 && <span style={{ width: 1, height: 22, background: 'var(--border-color)', alignSelf: 'center' }} />}
            {availableCats.map((cat) => (
              <FilterChip key={`cat${cat}`} label={cat} active={selectedCategory === cat}
                onClick={() => { setSelectedCategory(selectedCategory === cat ? '' : cat); setPage(1); }} />
            ))}
          </div>
        )}

        {/* ── TABLE VIEW ──────────────────────────────────────────────────── */}
        {activeViewTab === 'table' && (
          <div style={{ animation: 'cutoffFadeIn 0.3s ease' }}>
            {isLoading ? (
              <TableSkeleton />
            ) : cutoffRows.length === 0 ? (
              <div role="status" aria-live="polite"
                style={{ padding: '52px 28px', textAlign: 'center', background: 'var(--bg-main,#F8F8F6)', borderRadius: 16, border: '1.5px dashed var(--border-color)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 11, animation: 'cutoffFadeIn 0.3s ease' }}>
                <div style={{ fontSize: 46, lineHeight: 1 }}>🔍</div>
                <h4 className="font-serif" style={{ margin: 0, fontSize: 20 }}>No cutoff records found</h4>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, lineHeight: 1.55 }}>
                  No data matches the selected filters. Try a different academic year, round, course, or category.
                </p>
                <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 }}>
                  <button type="button" onClick={resetFilters} className="btn-editorial-primary" style={{ padding: '9px 20px', fontSize: 13 }}>Reset Filters</button>
                  <button type="button" onClick={() => setSelectedYear('')} className="btn-editorial-secondary" style={{ padding: '9px 20px', fontSize: 13 }}>View All Years</button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="cutoff-table-desktop"
                  style={{ overflowX: 'auto', borderRadius: 14, border: '1px solid var(--border-color)', WebkitOverflowScrolling: 'touch' }}
                  role="region" aria-label="Cutoff data table">
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-main,#F8F8F6)', borderBottom: '2px solid var(--border-color)' }}>
                        {([['year','Year'],['examCode','Exam'],['courseId','Course / Branch'],['round','Round'],['category','Category'],['closingRank','Closing ↕']] as [string|null,string][]).map(([f, lbl]) => (
                          <th key={lbl} onClick={f ? () => handleSort(f) : undefined}
                            className={f ? 'cutoff-th-sort' : undefined}
                            aria-sort={f && sortBy === f ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
                            style={{ padding: '11px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: sortBy === f ? 'var(--accent-blue)' : 'var(--text-muted)', cursor: f ? 'pointer' : 'default', whiteSpace: 'nowrap' as const, userSelect: 'none' as const, textAlign: 'left' as const, transition: 'color 0.15s ease' }}>
                            {lbl}{f && <SortIndicator field={f} sortBy={sortBy} sortOrder={sortOrder} />}
                          </th>
                        ))}
                        {dynamicExtraColumns.map((col) => (
                          <th key={col} style={{ padding: '11px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' as const }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cutoffRows.map((row, idx) => {
                        const bg = idx % 2 !== 0 ? 'var(--bg-main,rgba(248,248,246,0.5))' : 'transparent';
                        return (
                          <tr key={row._id || row.id || idx} className="cutoff-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '12px 14px', fontWeight: 700, background: bg }}>{row.year}</td>
                            <td style={{ padding: '12px 14px', background: bg }}>
                              <span style={{ display: 'inline-block', padding: '3px 9px', borderRadius: 999, background: 'rgba(45,110,163,0.10)', color: 'var(--accent-blue)', fontWeight: 700, fontSize: 11 }}>{row.examCode}</span>
                            </td>
                            <td style={{ padding: '12px 14px', background: bg, maxWidth: 210 }}>
                              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{row.courseName || row.courseId}</div>
                              {row.branch && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{row.branch}</div>}
                            </td>
                            <td style={{ padding: '12px 14px', background: bg }}><RoundBadge round={row.round} /></td>
                            <td style={{ padding: '12px 14px', background: bg }}><CategoryBadge category={row.category} /></td>
                            <td style={{ padding: '12px 14px', background: bg }}>
                              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, color: 'var(--accent-blue)' }}>#{row.closingRank.toLocaleString()}</span>
                            </td>
                            {dynamicExtraColumns.map((col) => (
                              <td key={col} style={{ padding: '12px 14px', fontSize: 12, background: bg }}>{row[col] != null ? String(row[col]) : '—'}</td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="cutoff-mobile-cards" style={{ flexDirection: 'column' as const, gap: 10 }}>
                  {cutoffRows.map((row, idx) => (
                    <div key={row._id || row.id || idx}
                      style={{ border: '1px solid var(--border-color)', borderRadius: 14, padding: 15, background: 'var(--bg-surface,#fff)', display: 'flex', flexDirection: 'column' as const, gap: 10, animation: 'cutoffFadeIn 0.3s ease' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{row.courseName || row.courseId}</div>
                          {row.branch && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{row.branch}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
                          <RoundBadge round={row.round} />
                          <CategoryBadge category={row.category} />
                        </div>
                      </div>
                      <div style={{ background: 'rgba(45,110,163,0.07)', padding: '10px 12px', borderRadius: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 2 }}>Closing Rank</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-heading)' }}>#{row.closingRank.toLocaleString()}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        <span>📅 {row.year}</span>
                        <span>🎓 {row.examCode}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 6, flexWrap: 'wrap', gap: 9 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Page <strong>{page}</strong> of <strong>{totalPages}</strong> · {totalRows.toLocaleString()} records
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page"
                    style={{ padding: '7px 15px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid var(--border-color)', background: 'var(--bg-surface,#fff)', color: 'var(--text-primary)', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.45 : 1, transition: 'all 0.15s ease' }}>
                    ← Prev
                  </button>
                  <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Next page"
                    style={{ padding: '7px 15px', borderRadius: 10, fontSize: 12, fontWeight: 600, border: '1px solid var(--border-color)', background: 'var(--bg-surface,#fff)', color: 'var(--text-primary)', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.45 : 1, transition: 'all 0.15s ease' }}>
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TREND CHARTS VIEW ─────────────────────────────────────────── */}
        {activeViewTab === 'trends' && (
          <div style={{ animation: 'cutoffFadeIn 0.3s ease', paddingBottom: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <h3 className="font-serif" style={{ fontSize: 17, margin: 0 }}>
                📊 Closing Rank Trend — {activeExam} · {selectedCategory || 'GM'}
              </h3>
              {cutoffRows.length > 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latest round per year</span>}
            </div>
            <div style={{ background: 'var(--bg-main,#F8F8F6)', borderRadius: 16, border: '1px solid var(--border-color)', padding: '20px 22px', overflowX: 'auto', marginBottom: 14 }}>
              <CutoffVisualizer rows={cutoffRows} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
              {[
                { icon: '📖', title: 'Round-by-Round Shift', body: 'Closing ranks typically relax between Round 1 and Round 2 as candidates retain or upgrade choices during counselling.' },
                { icon: '🎓', title: 'Category Competitiveness', body: 'GM cutoffs represent the highest competition threshold, while vertical/horizontal quota ranks admit at higher rank numbers.' },
              ].map(({ icon, title, body }) => (
                <div key={title} style={{ background: 'var(--bg-surface,#fff)', border: '1px solid var(--border-color)', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 6 }}>{icon} {title}</div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: 'var(--text-secondary)' }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AI INSIGHTS VIEW ─────────────────────────────────────────── */}
        {activeViewTab === 'insights' && (
          <div style={{ animation: 'cutoffFadeIn 0.3s ease', paddingBottom: 4 }}>
            {aiInsights ? (
              <div style={{ border: '1px solid rgba(45,110,163,0.18)', borderRadius: 16, overflow: 'hidden', marginBottom: 16 }}>
                {/* Gradient header */}
                <div style={{ background: 'linear-gradient(135deg,#1E3A5F 0%,#2D6EA3 60%,#4A8FC0 100%)', padding: '20px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 20 }}>🤖</span>
                      <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>AI Rank Intelligence</span>
                      <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.17)', color: '#fff', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>AI Estimate</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.82)', lineHeight: 1.5, maxWidth: 480 }}>{aiInsights.summaryText}</p>
                  </div>
                  <button type="button" onClick={() => setInsightsOpen(!insightsOpen)} aria-expanded={insightsOpen}
                    style={{ background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                    {insightsOpen ? '▲ Collapse' : '▼ Expand'}
                  </button>
                </div>
                {insightsOpen && (
                  <div style={{ padding: '20px 22px', background: 'var(--bg-surface,#fff)', display: 'flex', flexDirection: 'column' as const, gap: 18 }}>
                    {/* Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 11 }}>
                      <div style={{ background: 'var(--bg-main)', padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Trend Direction</span>
                        {(() => {
                          const isUp = aiInsights.trendDirection === 'tightened';
                          return (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13, background: isUp ? 'rgba(180,35,46,0.10)' : 'rgba(29,122,70,0.10)', color: isUp ? '#B4232E' : '#1D7A46', width: 'fit-content' }}>
                              {isUp ? '↑' : '↓'} {aiInsights.trendDirection.charAt(0).toUpperCase() + aiInsights.trendDirection.slice(1)} ({aiInsights.percentageChange > 0 ? '+' : ''}{aiInsights.percentageChange}%)
                            </span>
                          );
                        })()}
                      </div>
                      {aiInsights.predictedRankRange && (
                        <div style={{ background: 'rgba(45,110,163,0.06)', padding: '13px 15px', borderRadius: 12, border: '1px solid rgba(45,110,163,0.14)', display: 'flex', flexDirection: 'column' as const, gap: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>🔮 Predicted Next Year</span>
                          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--accent-blue)', fontFamily: 'var(--font-heading)' }}>#{aiInsights.predictedRankRange.min.toLocaleString()} – #{aiInsights.predictedRankRange.max.toLocaleString()}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Expected: #{aiInsights.predictedRankRange.expected.toLocaleString()}</span>
                        </div>
                      )}
                      <div style={{ background: 'var(--bg-main)', padding: '13px 15px', borderRadius: 12, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Admission Probability</span>
                        {(() => {
                          const pMap: Record<string,{bg:string;color:string;label:string}> = {
                            high:     { bg:'rgba(29,122,70,0.11)',  color:'#1D7A46', label:'High Probability'     },
                            moderate: { bg:'rgba(154,107,0,0.11)', color:'#9A6B00', label:'Moderate Probability' },
                            low:      { bg:'rgba(180,35,46,0.11)', color:'#B4232E', label:'Low Probability'      },
                          };
                          const s = pMap[aiInsights.admissionProbability] || pMap['moderate'];
                          return <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontWeight: 700, fontSize: 13, background: s.bg, color: s.color, width: 'fit-content' }}>{s.label}</span>;
                        })()}
                      </div>
                    </div>
                    {/* Key insights */}
                    <div>
                      <h4 style={{ margin: '0 0 9px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>💡 Key Analytics Highlights</h4>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column' as const, gap: 7 }}>
                        {aiInsights.keyInsights.map((insight, i) => (
                          <li key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '10px 13px', borderRadius: 10, background: 'var(--bg-main)', fontSize: 13, lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                            <span style={{ flexShrink: 0, width: 19, height: 19, borderRadius: '50%', background: 'rgba(45,110,163,0.10)', color: 'var(--accent-blue)', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                            <span>{insight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Disclaimer */}
                    <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', padding: '11px 14px', borderRadius: 10, background: 'rgba(154,107,0,0.06)', border: '1px solid rgba(154,107,0,0.14)' }}>
                      <span style={{ flexShrink: 0 }}>⚠️</span>
                      <p style={{ margin: 0, fontSize: 12, color: '#9A6B00', lineHeight: 1.5 }}>
                        <strong>Note:</strong> AI insights are model estimates based on historical trends. Actual cutoffs depend on the number of qualified candidates, exam difficulty, and seat availability. Always verify with official authorities.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '48px 24px', textAlign: 'center', background: 'var(--bg-main)', borderRadius: 16, border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 36 }}>⚙️</div>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Computing AI rank intelligence…</p>
              </div>
            )}
          </div>
        )}

        {/* Category legend */}
        <div role="complementary" aria-label="Category abbreviation legend"
          style={{ marginTop: 20, marginBottom: 0, padding: '11px 15px', borderRadius: 12, background: 'var(--bg-main,#F8F8F6)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginRight: 4 }}>Legend:</span>
          {LEGEND_CATS.map((cat) => (
            <button key={cat} type="button" onClick={() => setActiveTooltip(activeTooltip === cat ? null : cat)}
              aria-pressed={activeTooltip === cat} title={CATEGORY_TOOLTIPS[cat] || cat}
              style={{ padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: 'none', background: activeTooltip === cat ? 'rgba(45,110,163,0.11)' : 'var(--bg-surface,#fff)', color: activeTooltip === cat ? 'var(--accent-blue)' : 'var(--text-secondary)', outline: activeTooltip === cat ? '1.5px solid var(--accent-blue)' : '1px solid var(--border-color)', transition: 'all 0.15s ease' }}>
              {cat}
            </button>
          ))}
          {activeTooltip && CATEGORY_TOOLTIPS[activeTooltip] && (
            <div style={{ width: '100%', marginTop: 6, padding: '7px 11px', borderRadius: 8, background: 'rgba(45,110,163,0.07)', border: '1px solid rgba(45,110,163,0.14)', fontSize: 12, color: 'var(--accent-blue)', lineHeight: 1.5, animation: 'cutoffFadeIn 0.18s ease' }}>
              ℹ️ <strong>{activeTooltip}</strong>: {CATEGORY_TOOLTIPS[activeTooltip]}
            </div>
          )}
        </div>

        <div style={{ height: 22 }} />
      </div>
    </section>
  );
}

/* ─── CutoffVisualizer ───────────────────────────────────────────────────── */

function CutoffVisualizer({ rows }: { rows: CutoffRow[] }) {
  const points = useMemo(() => {
    const m = new Map<number, CutoffRow>();
    for (const r of rows) { const e = m.get(r.year); if (!e || r.round >= e.round) m.set(r.year, r); }
    return Array.from(m.values()).sort((a, b) => a.year - b.year);
  }, [rows]);

  if (points.length === 0) return <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Select filters to display the trend graph.</div>;

  const maxR = Math.max(...points.map((p) => p.closingRank), 1);
  const minR = Math.min(...points.map((p) => p.closingRank), 0);
  const range = maxR - minR || 1;
  const W = 720, H = 260;
  const pad = { top: 38, right: 38, bottom: 50, left: 70 };
  const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;
  const gap = 20;
  const barW = Math.min(54, (cW - gap * (points.length - 1)) / Math.max(points.length, 1));

  const linePts = points.map((p, i) => ({
    x: pad.left + i * (barW + gap) + gap / 2 + barW / 2,
    y: pad.top + cH - ((p.closingRank - minR) / range) * cH,
  }));
  const linePath  = linePts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath  = linePts.length > 0 ? `${linePath} L${linePts[linePts.length - 1].x},${H - pad.bottom} L${linePts[0].x},${H - pad.bottom} Z` : '';

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Cutoff closing rank trend chart">
      <defs>
        <linearGradient id="ccBarGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D6EA3" stopOpacity="0.90" />
          <stop offset="100%" stopColor="#4A8FC0" stopOpacity="0.45" />
        </linearGradient>
        <linearGradient id="ccAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2D6EA3" stopOpacity="0.13" />
          <stop offset="100%" stopColor="#2D6EA3" stopOpacity="0.01" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = pad.top + cH * (1 - frac);
        return (
          <g key={frac}>
            <line x1={pad.left} y1={y} x2={W - pad.right} y2={y} stroke="var(--border-color)" strokeDasharray="4 3" opacity={0.55} />
            <text x={pad.left - 7} y={y + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-body)">
              #{Math.round(minR + range * frac).toLocaleString()}
            </text>
          </g>
        );
      })}
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={H - pad.bottom} stroke="var(--border-color)" strokeWidth={1.5} />
      <line x1={pad.left} y1={H - pad.bottom} x2={W - pad.right} y2={H - pad.bottom} stroke="var(--border-color)" strokeWidth={1.5} />
      {points.map((p, i) => {
        const bH = ((p.closingRank - minR) / range) * cH;
        const x  = pad.left + i * (barW + gap) + gap / 2;
        const y  = H - pad.bottom - bH;
        return (
          <g key={p.year}>
            <rect x={x} y={y} width={barW} height={bH} rx={6} fill="url(#ccBarGrad)" />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--text-primary)" fontFamily="var(--font-body)">
              #{p.closingRank.toLocaleString()}
            </text>
          </g>
        );
      })}
      {areaPath && <path d={areaPath} fill="url(#ccAreaGrad)" />}
      {linePath && <path d={linePath} fill="none" stroke="#2D6EA3" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {linePts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke="#2D6EA3" strokeWidth={2.5} />)}
      {points.map((p, i) => {
        const x = pad.left + i * (barW + gap) + gap / 2 + barW / 2;
        return (
          <g key={`lbl${p.year}`}>
            <text x={x} y={H - pad.bottom + 16} textAnchor="middle" fontSize={12} fill="var(--text-secondary)" fontWeight={600} fontFamily="var(--font-body)">{p.year}</text>
            <text x={x} y={H - pad.bottom + 30} textAnchor="middle" fontSize={10} fill="var(--text-muted)" fontFamily="var(--font-body)">R{p.round}</text>
          </g>
        );
      })}
      <text x={pad.left} y={20} fontSize={10} fontWeight={700} fill="var(--text-muted)" fontFamily="var(--font-body)" letterSpacing="0.08em">CLOSING RANK TREND</text>
    </svg>
  );
}
