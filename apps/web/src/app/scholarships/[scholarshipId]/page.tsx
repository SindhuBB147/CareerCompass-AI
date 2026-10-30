'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { scholarshipsApi, type Scholarship, type EligibilityReport } from '../../../lib/scholarships-api';
import { formatAward } from '../../../lib/scholarship-format';
import { DeadlineChip } from '../../../components/scholarships/DeadlineChip';
import { EligibilityChecklist } from '../../../components/scholarships/EligibilityChecklist';
import { FaqAccordion } from '../../../components/scholarships/FaqAccordion';
import { ScholarshipCard } from '../../../components/scholarships/ScholarshipCard';

const VERDICT_COPY: Record<EligibilityReport['verdict'], { title: string; icon: string }> = {
  eligible: { title: "You're Eligible!", icon: '✅' },
  partially_eligible: { title: 'Possibly Eligible — Confirm Your Profile', icon: '🟡' },
  not_eligible: { title: 'Not Eligible', icon: '❌' },
};

const LINK_TILES: Array<{ key: keyof Scholarship['links']; icon: string; title: string; sub: string }> = [
  { key: 'officialWebsite', icon: '🌐', title: 'Official Website', sub: 'Learn more about this scholarship' },
  { key: 'applyLink', icon: '📝', title: 'Apply Now', sub: 'Official application portal' },
  { key: 'notificationPdf', icon: '📄', title: 'Official Notification', sub: 'Download the notification PDF' },
  { key: 'guidelinesPdf', icon: '📋', title: 'Guidelines', sub: 'Detailed application guidelines' },
  { key: 'helpdeskUrl', icon: '💬', title: 'Helpdesk', sub: 'Get support with your application' },
];

export default function ScholarshipDetailPage() {
  const params = useParams();
  const scholarshipId = params?.scholarshipId as string;
  const { isAuthenticated, accessToken } = useUserAuth();

  const [scholarship, setScholarship] = useState<Scholarship | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [eligibility, setEligibility] = useState<EligibilityReport | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);

  const [similar, setSimilar] = useState<Scholarship[]>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  useEffect(() => {
    if (!scholarshipId) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    scholarshipsApi.getDetail(scholarshipId)
      .then(data => { if (!cancelled) setScholarship(data); })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [scholarshipId]);

  useEffect(() => {
    if (!scholarship || !isAuthenticated || !accessToken) return;
    const id = scholarship.id || scholarship._id;
    setIsCheckingEligibility(true);
    scholarshipsApi.checkEligibility(accessToken, id)
      .then(setEligibility)
      .catch(() => setEligibility(null))
      .finally(() => setIsCheckingEligibility(false));

    scholarshipsApi.listBookmarks(accessToken)
      .then(res => setIsBookmarked(res.scholarships.some(s => (s.id || s._id) === id)))
      .catch(() => setIsBookmarked(false));
  }, [scholarship, isAuthenticated, accessToken]);

  useEffect(() => {
    if (!scholarship) return;
    const exam = scholarship.eligibility.exams?.[0];
    scholarshipsApi.search({ exam: exam as any, category: scholarship.categories?.[0], limit: 4 })
      .then(res => {
        const id = scholarship.id || scholarship._id;
        setSimilar(res.scholarships.filter(s => (s.id || s._id) !== id).slice(0, 3));
      })
      .catch(() => setSimilar([]));
  }, [scholarship]);

  const toggleBookmark = async () => {
    if (!scholarship || !accessToken) return;
    const id = scholarship.id || scholarship._id;
    try {
      if (isBookmarked) await scholarshipsApi.removeBookmark(accessToken, id);
      else await scholarshipsApi.addBookmark(accessToken, id);
      setIsBookmarked(!isBookmarked);
    } catch {
      // Non-fatal — leave state as-is.
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: scholarship?.name, url }); return; } catch { /* user cancelled */ }
    }
    await navigator.clipboard.writeText(url).catch(() => {});
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  };

  if (isLoading) return <div className="colleges-detail-loading">Loading scholarship details…</div>;

  if (notFound || !scholarship) {
    return (
      <div className="section-padding container-editorial">
        <div className="card-editorial colleges-empty-state">
          <div className="colleges-empty-icon">🔍</div>
          <h3 className="font-serif colleges-empty-title">Scholarship Not Found</h3>
          <p className="text-body colleges-empty-desc">This scholarship may have been removed or the link is incorrect.</p>
          <Link href="/scholarships" className="btn-editorial-primary">Back to Scholarships</Link>
        </div>
      </div>
    );
  }

  const e = scholarship.eligibility;

  return (
    <div className="section-padding container-editorial scholarship-detail-page">
      {/* HERO */}
      <section className="scholarship-detail-hero">
        <Link href="/scholarships" className="auth-link" style={{ fontSize: '13px' }}>← Back to Scholarships</Link>
        <div className="scholarship-detail-title-row">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 }}>
            <div className="colleges-badge-row">
              <span className="badge-editorial">{scholarship.provider}</span>
              {scholarship.type && <span className="colleges-badge-editorial-sm">{scholarship.type.replace(/-/g, ' ')}</span>}
              {scholarship.featured && <span className="colleges-badge colleges-badge-dark">Featured</span>}
              <DeadlineChip deadline={scholarship.applicationDeadline} opensAt={scholarship.applicationOpensAt} />
            </div>
            <h1 className="font-serif scholarship-detail-title">{scholarship.name}</h1>
            {scholarship.providerName && <p className="text-body" style={{ margin: 0 }}>{scholarship.providerName}</p>}
          </div>
          <div className="scholarship-detail-actions">
            {scholarship.links?.applyLink && (
              <a href={scholarship.links.applyLink} target="_blank" rel="noreferrer" className="btn-editorial-primary">🎯 Apply Now</a>
            )}
            {isAuthenticated && (
              <button type="button" className="btn-editorial-secondary" aria-pressed={isBookmarked} onClick={toggleBookmark}>
                {isBookmarked ? '♥ Saved' : '♡ Save'}
              </button>
            )}
            <button type="button" className="btn-editorial-secondary" onClick={handleShare}>{shareCopied ? '✓ Copied' : '🔗 Share'}</button>
            <button type="button" className="btn-editorial-secondary" onClick={() => window.print()}>🖨️ Print</button>
          </div>
        </div>
      </section>

      {/* ELIGIBILITY CHECKER */}
      {isAuthenticated ? (
        isCheckingEligibility ? (
          <div className="card-editorial"><p className="text-body">Checking your eligibility…</p></div>
        ) : eligibility && (
          <section className="card-editorial scholarship-eligibility-banner" data-verdict={eligibility.verdict}>
            <div className="scholarship-eligibility-head">
              <h2 className="scholarship-eligibility-verdict" data-verdict={eligibility.verdict}>
                {VERDICT_COPY[eligibility.verdict].icon} {VERDICT_COPY[eligibility.verdict].title}
              </h2>
              <span className="scholarship-eligibility-score">Match Score: {eligibility.score}/100</span>
            </div>
            <EligibilityChecklist checks={eligibility.checks} />
          </section>
        )
      ) : (
        <div className="card-editorial" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <p className="text-body" style={{ margin: 0 }}>Sign in to instantly check your eligibility against your student profile.</p>
          <Link href="/login/student" className="btn-editorial-primary">Sign In to Check Eligibility</Link>
        </div>
      )}

      {/* OVERVIEW */}
      <section className="colleges-two-col">
        <div className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">📖 About This Scholarship</h2>
          <p className="text-body">{scholarship.description}</p>
          {scholarship.benefits?.length > 0 && (
            <div>
              <h4 className="colleges-subheading">Benefits</h4>
              <div className="colleges-highlight-grid">
                {scholarship.benefits.map((b, idx) => <div key={idx} className="colleges-highlight-item">✓ {b}</div>)}
              </div>
            </div>
          )}
        </div>
        <div className="card-editorial colleges-section-block">
          <h3 className="font-serif colleges-section-title-sm">💰 Award Details</h3>
          <div className="colleges-stat-box colleges-stat-box-dark">
            <span className="colleges-stat-box-label">Maximum Amount</span>
            <div className="font-serif colleges-stat-box-value">{formatAward(scholarship.awardAmount)}</div>
          </div>
          {scholarship.renewalPolicy && (
            <div className="colleges-stat-box">
              <span className="colleges-stat-box-label">Renewal Policy</span>
              <div style={{ fontSize: '14px', marginTop: '4px' }}>{scholarship.renewalPolicy}</div>
            </div>
          )}
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Application Mode</span>
            <div style={{ fontSize: '14px', marginTop: '4px', textTransform: 'capitalize' }}>{scholarship.applicationMode}</div>
          </div>
        </div>
      </section>

      {/* ELIGIBILITY CRITERIA */}
      <section className="card-editorial colleges-section-block">
        <h2 className="font-serif colleges-section-title">🎯 Eligibility Criteria</h2>
        <div className="colleges-stat-grid-2">
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Applicable Exams</span>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{e.exams?.length ? e.exams.join(', ') : 'Any exam'}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Applicable States</span>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{e.states?.length ? e.states.join(', ') : 'All India'}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Reservation Eligibility</span>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{e.categories?.length ? e.categories.join(', ') : 'Open to all categories'}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Income Criteria</span>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{e.maxIncome ? `Below ₹${e.maxIncome.toLocaleString('en-IN')}/year` : 'No income limit'}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Academic Criteria / Minimum Marks</span>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{e.minAcademicPercent ? `Minimum ${e.minAcademicPercent}% marks` : (e.academicCriteriaNote || 'No minimum specified')}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Applicable Courses</span>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>{e.applicableCourses?.length ? e.applicableCourses.join(', ') : 'All courses'}</div>
          </div>
        </div>
        {(e.genderSpecific || e.minorityOnly || e.pwdOnly || (e.requiredReservations?.length ?? 0) > 0) && (
          <div className="colleges-badge-row">
            {e.genderSpecific && <span className="badge-editorial">👤 {e.genderSpecific} students only</span>}
            {e.minorityOnly && <span className="badge-editorial">🕊️ Minority status required</span>}
            {e.pwdOnly && <span className="badge-editorial">♿ PwD status required</span>}
            {e.requiredReservations?.map(r => <span key={r} className="badge-editorial">✓ {r}</span>)}
          </div>
        )}
      </section>

      {/* DOCUMENTS */}
      {scholarship.documents?.length > 0 && (
        <section className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">📁 Documents Required</h2>
          <div className="colleges-highlight-grid">
            {scholarship.documents.map(doc => <div key={doc} className="colleges-highlight-item scholarship-doc-chip">📄 {doc}</div>)}
          </div>
        </section>
      )}

      {/* APPLICATION PROCESS */}
      {scholarship.applicationSteps?.length > 0 && (
        <section className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">🗺️ Application Process</h2>
          <div className="colleges-timeline">
            {scholarship.applicationSteps.map(step => (
              <div key={step.stepNumber} className="colleges-timeline-item">
                <div className="colleges-timeline-number">{step.stepNumber}</div>
                <div className="colleges-timeline-body">
                  <h4 className="colleges-timeline-title">{step.title}</h4>
                  <p className="text-body colleges-timeline-desc">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* APPLICATION DATES */}
      <section className="card-editorial colleges-section-block">
        <h2 className="font-serif colleges-section-title">📅 Application Dates</h2>
        <div className="colleges-stat-grid-2">
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Opens</span>
            <div className="font-serif colleges-stat-box-value" style={{ fontSize: '18px' }}>
              {scholarship.applicationOpensAt ? new Date(scholarship.applicationOpensAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Deadline</span>
            <div className="font-serif colleges-stat-box-value" style={{ fontSize: '18px' }}>
              {new Date(scholarship.applicationDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      </section>

      {/* OFFICIAL LINKS */}
      <section className="card-editorial colleges-section-block">
        <h2 className="font-serif colleges-section-title">🔗 Official Links &amp; Contact</h2>
        <div className="scholarship-links-grid">
          {LINK_TILES.filter(t => scholarship.links?.[t.key]).map(t => (
            <a key={t.key} href={scholarship.links[t.key] as string} target="_blank" rel="noreferrer" className="scholarship-link-card">
              <span className="scholarship-link-icon">{t.icon}</span>
              <div>
                <p className="scholarship-link-title">{t.title}</p>
                <p className="scholarship-link-sub">{t.sub}</p>
              </div>
            </a>
          ))}
          {!scholarship.links?.officialWebsite && !scholarship.links?.applyLink && (
            <p className="text-body">Contact the provider directly for the official application link — see contact details below.</p>
          )}
        </div>
        {(scholarship.contact?.email || scholarship.contact?.phone) && (
          <div className="colleges-contact-list" style={{ marginTop: '8px' }}>
            {scholarship.contact.email && <div><span className="colleges-contact-label">Contact Email</span><a href={`mailto:${scholarship.contact.email}`} className="colleges-contact-link">{scholarship.contact.email}</a></div>}
            {scholarship.contact.phone && <div><span className="colleges-contact-label">Phone</span><strong>{scholarship.contact.phone}</strong></div>}
          </div>
        )}
      </section>

      {/* FAQ */}
      {scholarship.faqs?.length > 0 && (
        <section className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">❓ Frequently Asked Questions</h2>
          <FaqAccordion faqs={scholarship.faqs} />
        </section>
      )}

      {/* SIMILAR */}
      {similar.length > 0 && (
        <section className="colleges-section-block">
          <h2 className="font-serif colleges-section-title">🎓 Similar Scholarships</h2>
          <div className="colleges-grid-cards">
            {similar.map(s => <ScholarshipCard key={s.id || s._id} scholarship={s} />)}
          </div>
        </section>
      )}
    </div>
  );
}
