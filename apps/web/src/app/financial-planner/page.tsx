'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collegesApi } from '../../lib/colleges-api';
import { LoanPlannerView } from './components/LoanPlannerView';
import { PlannerForm, EMPTY_SELECTION, type PlannerSelection } from './components/PlannerForm';
import { FeeBreakdownView } from './components/FeeBreakdownView';
import { HostelLivingView } from './components/HostelLivingView';
import { DashboardSection } from './components/DashboardSection';
import { ComparisonView } from './components/ComparisonView';
import { RoiView } from './components/RoiView';
import { ExpenseSimulatorView } from './components/ExpenseSimulatorView';
import { ReportDownloadButton } from '../../components/ui/ReportDownloadButton';

type SectionKey = 'dashboard' | 'planner' | 'fee-breakdown' | 'hostel-living' | 'loan' | 'roi' | 'comparison' | 'simulator';

const SECTIONS: { key: SectionKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'planner', label: 'Planner' },
  { key: 'fee-breakdown', label: 'Fee Breakdown' },
  { key: 'hostel-living', label: 'Hostel & Living' },
  { key: 'loan', label: 'Loan Planner' },
  { key: 'roi', label: 'ROI Calculator' },
  { key: 'comparison', label: 'Compare Colleges' },
  { key: 'simulator', label: 'Expense Simulator' },
];

function SelectCollegePrompt() {
  return (
    <div className="card-editorial colleges-empty-state">
      <div className="colleges-empty-icon">🎓</div>
      <h3 className="font-serif colleges-empty-title">Select a College First</h3>
      <p className="text-body colleges-empty-desc">Head to the Planner tab and choose your college and course to see this section.</p>
    </div>
  );
}

function FinancialPlannerContent() {
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState<SectionKey>('planner');
  const [selection, setSelection] = useState<PlannerSelection>(EMPTY_SELECTION);
  const hasSelection = Boolean(selection.collegeId && selection.courseId);

  const updateSelection = (patch: Partial<PlannerSelection>) => setSelection(prev => ({ ...prev, ...patch }));

  // Deep-link support for the Wishlist card's "Financial Analysis" quick
  // action (?collegeId=&courseId=) — resolves the IDs into the full
  // selection PlannerForm needs, then jumps straight to the dashboard
  // instead of making the student re-pick the college manually.
  useEffect(() => {
    const collegeId = searchParams.get('collegeId');
    const courseId = searchParams.get('courseId');
    if (!collegeId || !courseId) return;
    let cancelled = false;
    collegesApi.getDetail(collegeId).then((college) => {
      if (cancelled) return;
      const course = college.courses?.find((c) => c.courseId === courseId) ?? college.courses?.[0];
      if (!course) return;
      setSelection({
        collegeId: college.id || college._id, collegeName: college.name, city: college.city,
        courseId: course.courseId, courseName: course.name, durationYears: course.durationYears,
        hostelRequired: college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel || false,
        accommodationType: 'hostel', transportPreference: 'public', includeLaptop: false,
        familyContribution: 0, currentSavings: 0,
      });
      setActiveSection('dashboard');
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>
              Higher Education Economics
            </span>
            <h1 className="text-section-title font-serif" style={{ margin: 0 }}>Financial Planning &amp; ROI Analysis</h1>
          </div>
          <ReportDownloadButton
            reportType="financial_planning"
            params={hasSelection ? { collegeCourseIds: [{ collegeId: selection.collegeId, courseId: selection.courseId }], hostelRequired: selection.hostelRequired } : undefined}
            tooltip="Download Financial Report"
            size="md"
          />
        </div>
        <p className="text-body" style={{ maxWidth: '720px' }}>
          Estimate your total cost of education, education loan EMIs, hostel &amp; living expenses, scholarship savings, and return on investment — grounded in real college fee and placement data.
        </p>
      </div>

      <div className="financial-tab-row">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActiveSection(s.key)}
            className={activeSection === s.key ? 'btn-editorial-primary' : 'btn-editorial-secondary'}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'dashboard' && (hasSelection ? <DashboardSection selection={selection} /> : <SelectCollegePrompt />)}
      {activeSection === 'planner' && <PlannerForm selection={selection} onChange={updateSelection} />}
      {activeSection === 'fee-breakdown' && (hasSelection ? <FeeBreakdownView selection={selection} /> : <SelectCollegePrompt />)}
      {activeSection === 'hostel-living' && (hasSelection ? <HostelLivingView selection={selection} /> : <SelectCollegePrompt />)}
      {activeSection === 'loan' && <LoanPlannerView />}
      {activeSection === 'roi' && (hasSelection ? <RoiView selection={selection} /> : <SelectCollegePrompt />)}
      {activeSection === 'comparison' && <ComparisonView />}
      {activeSection === 'simulator' && (hasSelection ? <ExpenseSimulatorView selection={selection} /> : <SelectCollegePrompt />)}
    </div>
  );
}

export default function FinancialPlannerPage() {
  return (
    <Suspense fallback={<div className="section-padding container-editorial" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}>
      <FinancialPlannerContent />
    </Suspense>
  );
}
