'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { collegesApi, type College, type CutoffRow } from '../../../lib/colleges-api';
import { wishlistApi } from '../../../lib/wishlist-api';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { readCompareIds, toggleCompareId } from '../../../lib/colleges-storage';
import { CutoffTrendChart } from '../../../components/colleges/CutoffTrendChart';
import { CollegeCutoffsSection } from '../../../components/colleges/CollegeCutoffsSection';
import { SeatMatrixView } from '../../../components/colleges/SeatMatrixView';
import { collegeImageSrc, onCollegeImageError } from '../../../lib/college-image';

const CATEGORIES_BY_EXAM: Record<string, string[]> = {
  KCET: ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B'],
  NEET: ['GM', 'SC', 'ST', 'Cat-1', '2A', '2B', '3A', '3B', 'EWS'],
  COMEDK: ['GM'],
};

const GENERIC_ADMISSION_DOCS = [
  '10th & 12th (or PU) Marks Cards', 'Entrance Exam Rank Card / Scorecard', 'Category & Income Certificate (if applicable)',
  'Domicile / Karnataka Study Certificate', 'Transfer Certificate & Migration Certificate', 'Passport-size Photographs & Valid Photo ID',
];

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} Lakh`;
}

function formatFee(amount: number | null | undefined): string {
  return amount ? formatLakh(amount) : 'Not publicly disclosed';
}

function isDisclosed(value: string | null | undefined): value is string {
  return !!value && value.trim().length > 0 && value.trim().toLowerCase() !== 'not publicly disclosed';
}

export default function CollegeDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { isAuthenticated, accessToken } = useUserAuth();
  const collegeId = params?.collegeId as string;

  const [college, setCollege] = useState<College | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [similar, setSimilar] = useState<College[]>([]);

  // Cutoff section state
  const [cutoffCourseId, setCutoffCourseId] = useState('');
  const [cutoffExam, setCutoffExam] = useState('');
  const [cutoffCategory, setCutoffCategory] = useState('GM');
  const [cutoffRows, setCutoffRows] = useState<CutoffRow[]>([]);
  const [isCutoffLoading, setIsCutoffLoading] = useState(false);

  // Gallery lightbox
  const [activeGalleryTab, setActiveGalleryTab] = useState('All');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Review submission
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ name: '', rating: 5, comment: '' });
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [liveReviews, setLiveReviews] = useState<College['reviewsList']>([]);

  const [isFavorite, setIsFavorite] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  useEffect(() => {
    if (!collegeId) return;
    let cancelled = false;
    setIsLoading(true);
    setNotFound(false);
    collegesApi
      .getDetail(collegeId)
      .then((data) => {
        if (cancelled) return;
        setCollege(data);
        setLiveReviews(data.reviewsList ?? []);
        const id = data.id || data._id;
        setIsComparing(readCompareIds().includes(id));
        if (data.courses?.length) {
          const firstCourse = data.courses[0];
          setCutoffCourseId(firstCourse.courseId);
          setCutoffExam(firstCourse.examsAccepted?.[0] ?? '');
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [collegeId]);

  // Saved status (now backend-backed) + Recently Viewed history — both
  // require auth, so they're skipped entirely for anonymous visitors.
  useEffect(() => {
    if (!collegeId || !isAuthenticated) { setIsFavorite(false); return; }
    let cancelled = false;
    wishlistApi.getSavedStatus(collegeId, accessToken)
      .then((res) => { if (!cancelled) setIsFavorite(res.saved); })
      .catch(() => { if (!cancelled) setIsFavorite(false); });
    wishlistApi.recordView(collegeId, accessToken).catch(() => {});
    return () => { cancelled = true; };
  }, [collegeId, isAuthenticated, accessToken]);

  // Similar colleges — same discipline, excluding this one, real search results.
  useEffect(() => {
    if (!college) return;
    const discipline = college.courses?.[0]?.discipline;
    let cancelled = false;
    collegesApi
      .search({ discipline, limit: 4, sortBy: 'nirf' })
      .then((res) => {
        if (cancelled) return;
        const id = college.id || college._id;
        setSimilar(res.results.filter((c) => (c.id || c._id) !== id).slice(0, 3));
      })
      .catch(() => setSimilar([]));
    return () => {
      cancelled = true;
    };
  }, [college]);

  // Cutoff trend fetch
  useEffect(() => {
    if (!college || !cutoffCourseId || !cutoffExam) return;
    let cancelled = false;
    setIsCutoffLoading(true);
    collegesApi
      .getCutoffTrend(college.id || college._id, cutoffCourseId, cutoffExam, cutoffCategory)
      .then((res) => {
        if (!cancelled) setCutoffRows(res.trend);
      })
      .catch(() => {
        if (!cancelled) setCutoffRows([]);
      })
      .finally(() => {
        if (!cancelled) setIsCutoffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [college, cutoffCourseId, cutoffExam, cutoffCategory]);

  const selectedCourse = useMemo(
    () => college?.courses.find((c) => c.courseId === cutoffCourseId),
    [college, cutoffCourseId],
  );
  const availableCategories = CATEGORIES_BY_EXAM[cutoffExam] ?? ['GM'];
  const availableExams = college?.courses.flatMap((c) => c.examsAccepted) ?? [];
  const uniqueExams = Array.from(new Set(availableExams));

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!college || !reviewForm.name || !reviewForm.comment) return;
    setIsSubmittingReview(true);
    setReviewError(null);
    try {
      const review = await collegesApi.addReview(college.id || college._id, {
        userName: reviewForm.name,
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });
      setLiveReviews((prev) => [review, ...prev]);
      setShowReviewModal(false);
      setReviewForm({ name: '', rating: 5, comment: '' });
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Could not submit review. Please try again.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  if (isLoading) {
    return <div className="colleges-detail-loading">Loading college profile…</div>;
  }

  if (notFound || !college) {
    return (
      <div className="section-padding container-editorial">
        <div className="card-editorial colleges-empty-state">
          <div className="colleges-empty-icon">🔍</div>
          <h3 className="font-serif colleges-empty-title">College Not Found</h3>
          <p className="text-body colleges-empty-desc">
            We couldn&apos;t find a college matching &quot;{collegeId}&quot;. It may have been removed or the link is incorrect.
          </p>
          <Link href="/colleges" className="btn-editorial-primary">Back to Colleges</Link>
        </div>
      </div>
    );
  }

  const id = college.id || college._id;
  // Only 'verified' images (or legacy entries predating the verification
  // field) are shown on the public profile — 'needs_review'/'rejected'
  // candidates stay admin-only until reviewed (see admin/colleges'
  // ImagesManagerModal for the full, unfiltered gallery).
  const verifiedGallery = college.gallery.filter((g) => !g.verificationStatus || g.verificationStatus === 'verified');
  const filteredGallery = activeGalleryTab === 'All' ? verifiedGallery : verifiedGallery.filter((g) => g.category === activeGalleryTab);
  const galleryTabs = ['All', ...Array.from(new Set(verifiedGallery.map((g) => g.category)))];

  return (
    <div className="section-padding container-editorial colleges-detail-page">

      {/* SECTION 1 — HERO */}
      <section className="card-editorial colleges-detail-hero">
        <div className="colleges-detail-hero-banner">
          <img
            src={collegeImageSrc(college.bannerImage)}
            onError={onCollegeImageError}
            alt=""
            decoding="async"
            className="colleges-detail-hero-banner-img"
          />
          <div className="colleges-detail-hero-banner-overlay" />
        </div>

        <div className="colleges-detail-hero-content">
          <div className="colleges-detail-hero-identity">
            {college.logo && <img src={college.logo} alt={`${college.name} logo`} className="colleges-detail-hero-logo" />}
            <div>
              <div className="colleges-detail-hero-badges">
                {college.accreditation?.nirfRank && <span className="colleges-badge colleges-badge-dark">NIRF #{college.accreditation.nirfRank}</span>}
                {college.accreditation?.naac && <span className="colleges-badge colleges-badge-accent">NAAC {college.accreditation.naac}</span>}
                <span className="colleges-badge colleges-badge-light">{college.collegeType}</span>
              </div>
              <h1 className="font-serif colleges-detail-hero-title">{college.name}</h1>
              <p className="colleges-detail-hero-meta">
                📍 {college.city}{college.district ? `, ${college.district}` : ''}, {college.state}
                {college.establishedYear ? ` • Estd ${college.establishedYear}` : ''}
                {college.aicteApproved && ' • AICTE Approved'}
                {college.rating != null ? ` • ★ ${college.rating} (${college.reviewsCount ?? 0} Reviews)` : ''}
                {college.collegeId && ` • ID: ${college.collegeId}`}
                {college.affiliatedUniversity && isDisclosed(college.affiliatedUniversity) && ` • ${college.affiliatedUniversity}`}
              </p>
            </div>
          </div>

          <div className="colleges-detail-hero-actions">
            <a href="#admissions" className="btn-editorial-primary">🎓 View Admission Process</a>
            {college.contact?.website && (
              <a href={college.contact.website} target="_blank" rel="noreferrer" className="btn-editorial-secondary colleges-detail-hero-secondary-btn">
                📄 Official Website
              </a>
            )}
            <button
              type="button"
              className="btn-editorial-secondary colleges-detail-hero-secondary-btn"
              aria-pressed={isFavorite}
              onClick={() => {
                if (!isAuthenticated) { router.push('/login/student'); return; }
                const wasSaved = isFavorite;
                setIsFavorite(!wasSaved); // instant feedback
                const action = wasSaved ? wishlistApi.remove(id, accessToken) : wishlistApi.save(id, undefined, accessToken);
                action.catch(() => setIsFavorite(wasSaved));
              }}
            >
              {isFavorite ? '♥ Saved to Wishlist' : '♡ Add to Wishlist'}
            </button>
            <button
              type="button"
              className="btn-editorial-secondary colleges-detail-hero-secondary-btn"
              aria-pressed={isComparing}
              onClick={() => setIsComparing(toggleCompareId(id).includes(id))}
            >
              {isComparing ? '✓ In Comparison' : '+ Add to Compare'}
            </button>
          </div>
        </div>
      </section>

      {/* DATA VERIFIED TRUST INDICATOR */}
      {college.metadata && (
        <div className="colleges-badge-row" style={{ marginTop: '0.5rem' }}>
          {college.metadata.dataVerified ? (
            <span className="badge-editorial">✓ Data Verified{college.metadata.lastVerified ? ` • ${new Date(college.metadata.lastVerified).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}` : ''}</span>
          ) : (
            <span className="colleges-badge colleges-badge-light">Unverified Data</span>
          )}
          {college.metadata.dataSources?.length > 0 && (
            <details className="colleges-contact-label" style={{ display: 'inline-block' }}>
              <summary style={{ cursor: 'pointer' }}>Sources</summary>
              <span className="text-body">{college.metadata.dataSources.length} reference{college.metadata.dataSources.length === 1 ? '' : 's'} on file</span>
            </details>
          )}
        </div>
      )}

      {/* SECTION 2 — ABOUT & HIGHLIGHTS */}
      <section className="colleges-two-col">
        <div className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">🏛️ About {college.name}</h2>
          <p className="text-body">{isDisclosed(college.about?.summary) ? college.about!.summary : college.description}</p>

          {isDisclosed(college.about?.history) && (
            <div>
              <h4 className="colleges-subheading">History</h4>
              <p className="text-body">{college.about!.history}</p>
            </div>
          )}
          {isDisclosed(college.about?.vision) && (
            <div>
              <h4 className="colleges-subheading">Vision</h4>
              <p className="text-body">{college.about!.vision}</p>
            </div>
          )}
          {isDisclosed(college.about?.mission) && (
            <div>
              <h4 className="colleges-subheading">Mission</h4>
              <p className="text-body">{college.about!.mission}</p>
            </div>
          )}

          {college.highlights?.length > 0 && (
            <div>
              <h4 className="colleges-subheading">Key Institution Highlights</h4>
              <div className="colleges-highlight-grid">
                {college.highlights.map((hl, idx) => (
                  <div key={idx} className="colleges-highlight-item">✓ {hl}</div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card-editorial colleges-section-block">
          <h3 className="font-serif colleges-section-title-sm">📊 Campus Overview</h3>
          <div className="colleges-stat-grid-2">
            {college.campusSizeAcres != null && (
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">Campus Size</span>
                <div className="font-serif colleges-stat-box-value">{college.campusSizeAcres} Acres</div>
              </div>
            )}
            {college.studentCount != null && (
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">Student Intake</span>
                <div className="font-serif colleges-stat-box-value">{college.studentCount}+</div>
              </div>
            )}
            {college.facultyCount != null && (
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">Faculty Strength</span>
                <div className="font-serif colleges-stat-box-value">{college.facultyCount}</div>
              </div>
            )}
            <div className="colleges-stat-box">
              <span className="colleges-stat-box-label">NBA Accredited</span>
              <div className="font-serif colleges-stat-box-value">{college.accreditation?.nbaCourses?.length ?? 0} Depts</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2B — CAMPUS & ARCHITECTURE */}
      {college.campus && (isDisclosed(college.campus.description) || college.campus.architectureHighlights?.length > 0 || college.campus.facilities?.length > 0) && (
        <section className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">🏗️ Campus & Architecture</h2>
          {isDisclosed(college.campus.description) && <p className="text-body">{college.campus.description}</p>}
          {college.campus.architectureHighlights?.length > 0 && (
            <div>
              <h4 className="colleges-subheading">Architecture Highlights</h4>
              <div className="colleges-highlight-grid">
                {college.campus.architectureHighlights.map((hl, idx) => (
                  <div key={idx} className="colleges-highlight-item">✓ {hl}</div>
                ))}
              </div>
            </div>
          )}
          {college.campus.facilities?.length > 0 && (
            <div>
              <h4 className="colleges-subheading">Campus Facilities</h4>
              <div className="colleges-badge-row">
                {college.campus.facilities.map((f, idx) => (
                  <span key={idx} className="colleges-pill">⚡ {f}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* SECTION 3 — COURSES */}
      <section className="card-editorial colleges-section-block" id="courses">
        <h2 className="font-serif colleges-section-title">📚 Courses, Seats & Fees</h2>
        <div className="colleges-course-grid">
          {college.courses?.map((crc) => (
            <div key={crc.courseId} className="colleges-course-card">
              <div className="colleges-course-card-top">
                <span className="colleges-badge-editorial-sm">{crc.degreeType} • {crc.durationYears} Yrs</span>
                <span className="colleges-course-seats">Seats: {crc.intake}</span>
              </div>
              <h3 className="font-serif colleges-course-name">{crc.name}</h3>
              <p className="colleges-course-eligibility">{crc.eligibility}</p>
              <p className="colleges-course-exams">Exams Accepted: {crc.examsAccepted?.join(', ')}</p>
              <div className="colleges-course-card-footer">
                <div>
                  <span className="colleges-course-footer-label">Annual Fee</span>
                  <strong className="colleges-course-footer-value">{crc.feePerYear ? formatLakh(crc.feePerYear) : 'On Request'}</strong>
                </div>
                <div>
                  <span className="colleges-course-footer-label">Cutoff Rank</span>
                  <strong className="colleges-course-footer-value">{crc.cutoffRankSummary ? `#${crc.cutoffRankSummary}` : 'N/A'}</strong>
                </div>
              </div>
              {crc.seatMatrix && (
                <SeatMatrixView seatMatrix={crc.seatMatrix} courseName={crc.name} />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 4 — ADMISSIONS */}
      <section className="card-editorial colleges-section-block" id="admissions">
        <h2 className="font-serif colleges-section-title">🗺️ Admissions</h2>
        {uniqueExams.length > 0 && (
          <div className="colleges-exam-chip-row">
            {uniqueExams.map((exam) => <span key={exam} className="colleges-badge-editorial-sm">{exam}</span>)}
          </div>
        )}

        {college.admissionProcess?.length > 0 && (
          <div className="colleges-timeline">
            {college.admissionProcess.map((step) => (
              <div key={step.stepNumber} className="colleges-timeline-item">
                <div className="colleges-timeline-number">{step.stepNumber}</div>
                <div className="colleges-timeline-body">
                  <h4 className="colleges-timeline-title">{step.title}</h4>
                  <p className="text-body colleges-timeline-desc">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {college.admissionRoutes?.length > 0 && (
          <div className="colleges-docs-block">
            <h4 className="colleges-subheading">Admission Routes</h4>
            <div className="colleges-course-grid">
              {college.admissionRoutes.map((r, idx) => (
                <div key={idx} className="colleges-course-card">
                  <h3 className="font-serif colleges-course-name">{r.route}</h3>
                  {isDisclosed(r.eligibility) && <p className="colleges-course-eligibility"><strong>Eligibility:</strong> {r.eligibility}</p>}
                  {isDisclosed(r.process) && <p className="colleges-course-eligibility"><strong>Process:</strong> {r.process}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="colleges-docs-block">
          <h4 className="colleges-subheading">General Counselling Documents (KEA / COMEDK / NEET)</h4>
          <div className="colleges-highlight-grid">
            {GENERIC_ADMISSION_DOCS.map((doc) => (
              <div key={doc} className="colleges-highlight-item">📄 {doc}</div>
            ))}
          </div>
        </div>
      </section>

      {/* DYNAMIC COLLEGE CUTOFFS SECTION */}
      <CollegeCutoffsSection college={college} />

      {/* SECTION 6 — FEE STRUCTURE */}
      <section className="card-editorial colleges-section-block">
        <h2 className="font-serif colleges-section-title">💰 Fee Structure (Per Annum)</h2>
        <div className="colleges-fee-grid">
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Tuition Fee</span>
            <div className="font-serif colleges-stat-box-value">{formatFee(college.feeBreakdown?.tuitionFee)}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Hostel Fee</span>
            <div className="font-serif colleges-stat-box-value">{formatFee(college.feeBreakdown?.hostelFee)}</div>
          </div>
          <div className="colleges-stat-box">
            <span className="colleges-stat-box-label">Mess Charges</span>
            <div className="font-serif colleges-stat-box-value">{college.feeBreakdown?.messFee ? `₹${(college.feeBreakdown.messFee / 1000).toFixed(0)}k` : 'Not publicly disclosed'}</div>
          </div>
          <div className="colleges-stat-box colleges-stat-box-dark">
            <span className="colleges-stat-box-label">Total Annual Fee</span>
            <div className="font-serif colleges-stat-box-value">{formatFee(college.feeBreakdown?.totalAnnualFee)}</div>
          </div>
        </div>

        {college.feeBreakdown?.byQuota && (
          college.feeBreakdown.byQuota.kcetFee || college.feeBreakdown.byQuota.comedkFee || college.feeBreakdown.byQuota.managementFee
        ) && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 className="colleges-subheading">
              Fee by Admission Quota{college.feeBreakdown.byQuota.academicYear ? ` (AY ${college.feeBreakdown.byQuota.academicYear})` : ''}
            </h4>
            <div className="colleges-fee-grid">
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">KCET Quota</span>
                <div className="font-serif colleges-stat-box-value">{formatFee(college.feeBreakdown.byQuota.kcetFee)}</div>
              </div>
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">COMEDK Quota</span>
                <div className="font-serif colleges-stat-box-value">{formatFee(college.feeBreakdown.byQuota.comedkFee)}</div>
              </div>
              <div className="colleges-stat-box">
                <span className="colleges-stat-box-label">Management Quota</span>
                <div className="font-serif colleges-stat-box-value">{formatFee(college.feeBreakdown.byQuota.managementFee)}</div>
              </div>
            </div>
          </div>
        )}

        {college.feeBreakdown?.byAdmissionCode && college.feeBreakdown.byAdmissionCode.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <h4 className="colleges-subheading">Fee by Alternate Admission Code</h4>
            <div className="colleges-table-wrap">
              <table className="colleges-table">
                <thead>
                  <tr>
                    <th>Admission Code</th><th>Academic Year</th><th>KCET Fee</th><th>COMEDK Fee</th><th>Management Fee</th>
                  </tr>
                </thead>
                <tbody>
                  {college.feeBreakdown.byAdmissionCode.map((row, idx) => (
                    <tr key={idx}>
                      <td><span className="badge-editorial">Also admits via code {row.admissionCode}</span></td>
                      <td>{row.academicYear ?? '—'}</td>
                      <td>{formatFee(row.kcetFee)}</td>
                      <td>{formatFee(row.comedkFee)}</td>
                      <td>{formatFee(row.managementFee)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 7 — HOSTEL */}
      {(college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel || isDisclosed(college.hostelInfo?.messDetails) || college.hostelInfo?.hostelFeePerYear || college.hostelInfo?.amenities?.length) ? (
      <section className="card-editorial colleges-section-block">
        <h2 className="font-serif colleges-section-title">🏡 Hostel & Amenities</h2>
        <div className="colleges-two-col-even">
          <div>
            <h4 className="colleges-subheading">Hostel Overview</h4>
            {isDisclosed(college.hostelInfo?.messDetails) && <p className="text-body">{college.hostelInfo!.messDetails}</p>}
            <div className="colleges-badge-row">
              {college.hostelInfo?.boysHostel && <span className="badge-editorial">✓ Boys Hostel</span>}
              {college.hostelInfo?.girlsHostel && <span className="badge-editorial">✓ Girls Hostel</span>}
              {!college.hostelInfo?.boysHostel && !college.hostelInfo?.girlsHostel && <span className="badge-editorial">Not Available</span>}
            </div>
            {college.hostelInfo?.hostelFeePerYear ? (
              <div className="colleges-stat-box" style={{ marginTop: '1rem' }}>
                <span className="colleges-stat-box-label">
                  Hostel Fee{college.hostelInfo.hostelFeeAcademicYear ? ` (AY ${college.hostelInfo.hostelFeeAcademicYear})` : ''}
                </span>
                <div className="font-serif colleges-stat-box-value">{formatLakh(college.hostelInfo.hostelFeePerYear)}</div>
              </div>
            ) : (
              <p className="text-body colleges-section-subtitle" style={{ marginTop: '0.5rem' }}>Hostel fee: Not publicly disclosed</p>
            )}
          </div>
          <div>
            <h4 className="colleges-subheading">Amenities</h4>
            <div className="colleges-badge-row">
              {college.hostelInfo?.amenities?.length ? college.hostelInfo.amenities.map((am, idx) => (
                <span key={idx} className="colleges-pill">⚡ {am}</span>
              )) : <span className="text-body">Not publicly disclosed</span>}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {/* SECTION 8 — GALLERY */}
      {verifiedGallery.length > 0 && (
        <section className="card-editorial colleges-section-block">
          <div className="colleges-section-header-row">
            <h2 className="font-serif colleges-section-title">📸 Campus Gallery</h2>
            <div className="colleges-gallery-tabs">
              {galleryTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveGalleryTab(tab)}
                  className="colleges-gallery-tab"
                  data-active={activeGalleryTab === tab || undefined}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="colleges-gallery-grid">
            {filteredGallery.map((img, idx) => (
              <button key={img.id ?? idx} type="button" onClick={() => setLightboxImage(img.url)} className="colleges-gallery-item" aria-label={`View ${img.title}`}>
                <img
                  src={img.thumbnailUrl || img.url}
                  onError={onCollegeImageError}
                  alt={img.altText || img.title}
                  loading="lazy"
                  decoding="async"
                  className="colleges-gallery-img"
                />
                <div className="colleges-gallery-overlay"><span>{img.title}</span></div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* SECTION 9 — PLACEMENTS */}
      {college.placementSummary?.length > 0 && (
        <section className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">💼 Placements</h2>
          {[...college.placementSummary].reverse().map((p) => (
            <div key={p.year} className="colleges-placement-year-block">
              <h4 className="colleges-subheading">{p.year} Batch</h4>
              <div className="colleges-fee-grid">
                <div className="colleges-stat-box">
                  <span className="colleges-stat-box-label">Highest Package</span>
                  <div className="font-serif colleges-stat-box-value">{p.highestPackage ? `₹${p.highestPackage} LPA` : 'Not publicly disclosed'}</div>
                </div>
                <div className="colleges-stat-box">
                  <span className="colleges-stat-box-label">Average Package</span>
                  <div className="font-serif colleges-stat-box-value">{p.averagePackage ? `₹${p.averagePackage} LPA` : 'Not publicly disclosed'}</div>
                </div>
                <div className="colleges-stat-box">
                  <span className="colleges-stat-box-label">Median Package</span>
                  <div className="font-serif colleges-stat-box-value">{p.medianPackage ? `₹${p.medianPackage} LPA` : 'Not publicly disclosed'}</div>
                </div>
                <div className="colleges-stat-box">
                  <span className="colleges-stat-box-label">Placement Rate</span>
                  <div className="font-serif colleges-stat-box-value">{p.placementPercentage != null ? `${p.placementPercentage}%` : 'Not publicly disclosed'}</div>
                </div>
              </div>
              {p.topRecruiters?.length > 0 && (
                <div className="colleges-badge-row">
                  {p.topRecruiters.map((rec, idx) => <span key={idx} className="colleges-pill">🏢 {rec}</span>)}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* SECTION 10 — CONTACT */}
      <section className="card-editorial colleges-section-block">
        <h2 className="font-serif colleges-section-title">📞 Contact & Location</h2>
        <div className="colleges-two-col-even">
          <div className="colleges-contact-list">
            {isDisclosed(college.contact?.address) && <div><span className="colleges-contact-label">Address</span><strong>{college.contact!.address}</strong></div>}
            {isDisclosed(college.contact?.phone) && <div><span className="colleges-contact-label">Phone</span><strong>{college.contact!.phone}</strong></div>}
            {isDisclosed(college.contact?.email) && <div><span className="colleges-contact-label">Email</span><strong>{college.contact!.email}</strong></div>}
            {college.contact?.admissionPhone && isDisclosed(college.contact.admissionPhone) && <div><span className="colleges-contact-label">Admission Phone</span><strong>{college.contact.admissionPhone}</strong></div>}
            {college.contact?.admissionEmail && isDisclosed(college.contact.admissionEmail) && <div><span className="colleges-contact-label">Admission Email</span><strong>{college.contact.admissionEmail}</strong></div>}
            {college.contact?.website && (
              <div>
                <span className="colleges-contact-label">Website</span>
                <a href={college.contact.website} target="_blank" rel="noreferrer" className="colleges-contact-link">{college.contact.website}</a>
              </div>
            )}
            {!isDisclosed(college.contact?.address) && !isDisclosed(college.contact?.phone) && !isDisclosed(college.contact?.email) && !college.contact?.website && (
              <p className="text-body">Contact information not publicly available.</p>
            )}
          </div>
          <div className="colleges-map-placeholder">
            {college.contact?.googleMapQuery ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(college.contact.googleMapQuery)}`}
                target="_blank" rel="noreferrer" className="colleges-map-link"
              >
                📍 Open in Google Maps
              </a>
            ) : (
              <span className="text-body">{college.city}, {college.state}</span>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 11 — REVIEWS */}
      <section className="card-editorial colleges-section-block">
        <div className="colleges-section-header-row">
          <div>
            <h2 className="font-serif colleges-section-title">⭐ Student Reviews</h2>
            <p className="text-body colleges-section-subtitle">
              {college.rating != null
                ? `Overall Rating: ★ ${college.rating} / 5.0 (${college.reviewsCount ?? 0} reviews)`
                : 'No ratings yet'}
            </p>
          </div>
          <button type="button" onClick={() => setShowReviewModal(true)} className="btn-editorial-primary">+ Write a Review</button>
        </div>

        {liveReviews.length === 0 ? (
          <p className="text-body">No reviews yet — be the first to share your experience.</p>
        ) : (
          <div className="colleges-review-grid">
            {liveReviews.map((rev) => (
              <div key={rev.id} className="colleges-review-card">
                <div className="colleges-review-card-top">
                  <strong>{rev.userName}</strong>
                  <span className="colleges-review-rating">★ {rev.rating}</span>
                </div>
                <span className="colleges-review-role">✓ {rev.userRole}</span>
                <p className="text-body colleges-review-comment">&quot;{rev.comment}&quot;</p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 12 — SIMILAR COLLEGES */}
      {similar.length > 0 && (
        <section className="card-editorial colleges-section-block">
          <h2 className="font-serif colleges-section-title">🏢 Similar Colleges</h2>
          <div className="colleges-similar-grid">
            {similar.map((item) => (
              <div key={item.id || item._id} className="colleges-similar-card">
                <h3 className="font-serif colleges-similar-name">{item.name}</h3>
                <p className="colleges-similar-meta">📍 {item.city} {item.accreditation?.nirfRank ? `• NIRF #${item.accreditation.nirfRank}` : ''}</p>
                <Link href={`/colleges/${item.slug}`} className="btn-editorial-secondary colleges-similar-cta">View Details</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* REVIEW MODAL */}
      {showReviewModal && (
        <div className="colleges-modal-overlay" role="dialog" aria-modal="true" aria-label="Write a review">
          <form onSubmit={handleSubmitReview} className="card-editorial colleges-modal">
            <h3 className="font-serif colleges-modal-title">Write a Review</h3>
            <div className="colleges-filter-group">
              <label htmlFor="review-name" className="colleges-filter-label">Your Name</label>
              <input id="review-name" type="text" placeholder="e.g. Rohan S (CSE 2024)" value={reviewForm.name}
                onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })} required className="input-editorial" />
            </div>
            <div className="colleges-filter-group">
              <label htmlFor="review-rating" className="colleges-filter-label">Overall Rating</label>
              <select id="review-rating" value={reviewForm.rating}
                onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })} className="input-editorial">
                <option value={5}>★★★★★ 5.0 (Excellent)</option>
                <option value={4}>★★★★☆ 4.0 (Very Good)</option>
                <option value={3}>★★★☆☆ 3.0 (Average)</option>
                <option value={2}>★★☆☆☆ 2.0 (Below Average)</option>
                <option value={1}>★☆☆☆☆ 1.0 (Poor)</option>
              </select>
            </div>
            <div className="colleges-filter-group">
              <label htmlFor="review-comment" className="colleges-filter-label">Your Feedback</label>
              <textarea id="review-comment" placeholder="Share your experience about academics, placements, campus life..."
                value={reviewForm.comment} onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                required rows={4} className="input-editorial" style={{ resize: 'vertical' }} />
            </div>
            {reviewError && <p className="colleges-form-error">{reviewError}</p>}
            <div className="colleges-modal-actions">
              <button type="button" onClick={() => setShowReviewModal(false)} className="btn-editorial-secondary" style={{ flex: 1 }}>Cancel</button>
              <button type="submit" disabled={isSubmittingReview} className="btn-editorial-primary" style={{ flex: 1 }}>
                {isSubmittingReview ? 'Submitting…' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxImage && (
        <div onClick={() => setLightboxImage(null)} className="colleges-lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
          <img src={lightboxImage} alt="Campus view" className="colleges-lightbox-img" />
        </div>
      )}
    </div>
  );
}
