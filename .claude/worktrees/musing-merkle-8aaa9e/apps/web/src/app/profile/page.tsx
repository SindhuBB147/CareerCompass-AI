'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { apiClient } from '../../lib/api-client';
import { scholarshipsApi } from '../../lib/scholarships-api';
import { EXAM_LABELS } from '../onboarding/types';

const NAV_SECTIONS = [
  { key: 'overview', label: 'Overview', icon: '🏠' },
  { key: 'personal', label: 'Personal Info', icon: '👤' },
  { key: 'academic', label: 'Academic & Exams', icon: '🎓' },
  { key: 'preferences', label: 'Preferences & Goals', icon: '🧭' },
  { key: 'colleges', label: 'Saved Colleges', icon: '🏛️' },
  { key: 'predictions', label: 'Predictions & Roadmap', icon: '📈' },
  { key: 'scholarships', label: 'Scholarships & Finance', icon: '💰' },
];

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();

  const [section, setSection] = useState(searchParams.get('section') ?? 'overview');
  const [profile, setProfile] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [completion, setCompletion] = useState<any>(null);
  const [scholarshipsEligibleCount, setScholarshipsEligibleCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }

    (async () => {
      try {
        const [profileData, dashboardData, completionData] = await Promise.all([
          apiClient.get<any>('/users/me', accessToken),
          apiClient.get<any>('/users/me/dashboard', accessToken),
          apiClient.get<any>('/users/me/profile-completion', accessToken),
        ]);
        setProfile(profileData);
        setDashboard(dashboardData);
        setCompletion(completionData);
      } catch {
        // Non-fatal — sections render their own empty states.
      } finally {
        setLoading(false);
      }
    })();

    // Separate, best-effort fetch — the Scholarship module's recommendation
    // count overrides the dashboard's static placeholder without requiring
    // the users/scholarships backend modules to depend on each other.
    if (accessToken) {
      scholarshipsApi.getRecommended(accessToken)
        .then(res => setScholarshipsEligibleCount(res.recommendations.length))
        .catch(() => setScholarshipsEligibleCount(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  if (authLoading || loading) {
    return <div className="profile-page container-editorial"><p className="wizard-hint">Loading your profile…</p></div>;
  }

  const name = profile?.fullName ?? user?.name ?? 'Student';
  const completionPct = completion?.percent ?? 0;

  return (
    <div className="profile-page container-editorial">
      {/* Hero */}
      <div className="card-editorial profile-hero">
        <div className="profile-hero-identity">
          {profile?.photoUrl ? (
            <img src={profile.photoUrl} alt={name} className="profile-avatar" />
          ) : (
            <div className="profile-avatar-fallback">{name.charAt(0)}</div>
          )}
          <div>
            <h1 className="font-serif profile-hero-name">Welcome back, {name.split(' ')[0]}</h1>
            <p className="profile-hero-meta">
              {profile?.email ?? user?.email} {profile && !profile.isEmailVerified && <> · <Link href="/verify-email" className="auth-link">Verify email</Link></>}
            </p>
          </div>
        </div>

        <div className="profile-completion-ring-wrap">
          <div>
            <div className="profile-completion-track">
              <div className="profile-completion-fill" style={{ width: `${completionPct}%` }} />
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Profile completion</span>
          </div>
          <span className="profile-completion-pct">{completionPct}%</span>
        </div>

        <div className="profile-hero-actions">
          {!profile?.onboarding?.completed && (
            <Link href="/onboarding" className="btn-editorial-primary" style={{ textDecoration: 'none' }}>Continue Setup</Link>
          )}
          <Link href="/profile/settings" className="btn-editorial-secondary" style={{ textDecoration: 'none' }}>Account Settings</Link>
          <Link href="/profile/security" className="btn-editorial-secondary" style={{ textDecoration: 'none' }}>🛡️ Security</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="profile-stats-grid">
        <StatCard icon="🧠" label="AI Readiness" value={`${dashboard?.aiReadinessScore ?? 0}%`} />
        <StatCard icon="📝" label="Exams Added" value={dashboard?.examsCount ?? 0} />
        <StatCard icon="🏛️" label="Saved Colleges" value={dashboard?.savedCollegesCount ?? 0} />
        <StatCard icon="📈" label="Predictions Run" value={dashboard?.predictionsCount ?? 0} />
        <StatCard icon="💰" label="Scholarships Eligible" value={scholarshipsEligibleCount ?? dashboard?.scholarshipsEligibleCount ?? 0} />
        <StatCard icon="🗺️" label="Roadmap Progress" value={`${dashboard?.careerRoadmapProgressPercent ?? 0}%`} />
      </div>

      {completion?.checks?.length > 0 && (
        <div className="card-editorial profile-completion-card">
          <div className="profile-section-title-row">
            <h2 className="profile-section-title">Finish setting up your profile</h2>
            <span className="badge-editorial">{completion.completedSteps}/{completion.totalSteps} done</span>
          </div>
          <div className="profile-missing-list">
            {completion.checks.map((c: any) => (
              <div key={c.key} className="profile-missing-item">
                <span>{c.label}</span>
                <Link href="/onboarding" className="btn-editorial-secondary profile-missing-cta" style={{ textDecoration: 'none' }}>Complete</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="profile-body-layout">
        <nav className="profile-nav" aria-label="Profile sections">
          {NAV_SECTIONS.map(s => (
            <button key={s.key} className="profile-nav-item" data-active={section === s.key} onClick={() => setSection(s.key)}>
              <span>{s.icon}</span> {s.label}
            </button>
          ))}
        </nav>

        <div className="profile-section">
          {section === 'overview' && <OverviewSection profile={profile} />}
          {section === 'personal' && <PersonalSection profile={profile} />}
          {section === 'academic' && <AcademicSection profile={profile} />}
          {section === 'preferences' && <PreferencesSection profile={profile} />}
          {section === 'colleges' && <LinkOutSection title="Saved Colleges" description="Browse Karnataka engineering colleges and save your shortlist." cta="Browse Colleges" href="/colleges" />}
          {section === 'predictions' && <LinkOutSection title="Predictions & Roadmap" description="Run admission probability predictions and view your AI-generated career roadmap." cta="Open Predictions" href="/predictions" secondaryCta="View Roadmap" secondaryHref="/roadmap" />}
          {section === 'scholarships' && <LinkOutSection title="Scholarships & Financial Planner" description="Find scholarships you're eligible for and plan your education budget." cta="Browse Scholarships" href="/scholarships" secondaryCta="Financial Planner" secondaryHref="/financial-planner" />}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string | number }) {
  return (
    <div className="card-editorial profile-stat-card">
      <span className="profile-stat-icon">{icon}</span>
      <span className="profile-stat-value">{value}</span>
      <span className="profile-stat-label">{label}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="profile-field">
      <span className="profile-field-label">{label}</span>
      <span className="profile-field-value">{value || value === 0 ? value : <span className="profile-empty-inline">Not set</span>}</span>
    </div>
  );
}

function SectionCard({ title, editHref, children }: { title: string; editHref?: string; children: React.ReactNode }) {
  return (
    <div className="card-editorial profile-section-card">
      <div className="profile-section-title-row">
        <h2 className="profile-section-title">{title}</h2>
        {editHref && <Link href={editHref} className="btn-editorial-secondary" style={{ padding: '8px 16px', fontSize: '13px', textDecoration: 'none' }}>Edit</Link>}
      </div>
      {children}
    </div>
  );
}

function OverviewSection({ profile }: { profile: any }) {
  return (
    <>
      <SectionCard title="Career Goal">
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          {profile?.aiPersonalization?.careerGoal || <span className="profile-empty-inline">Add your career goal in the AI Personalization step of onboarding.</span>}
        </p>
      </SectionCard>
      <SectionCard title="Recent AI Chats">
        <p className="profile-empty-inline">No recent conversations yet.</p>
        <Link href="/counsellor" className="btn-editorial-secondary" style={{ alignSelf: 'flex-start', textDecoration: 'none' }}>Open AI Counsellor</Link>
      </SectionCard>
      <SectionCard title="Upcoming Counselling Dates">
        <p className="profile-empty-inline">No counselling sessions scheduled.</p>
      </SectionCard>
    </>
  );
}

function PersonalSection({ profile }: { profile: any }) {
  return (
    <SectionCard title="Personal Information" editHref="/onboarding?step=1">
      <div className="profile-form-grid">
        <Field label="Full Name" value={profile?.fullName} />
        <Field label="Gender" value={profile?.gender} />
        <Field label="Date of Birth" value={profile?.dob ? new Date(profile.dob).toLocaleDateString() : undefined} />
        <Field label="Phone" value={profile?.phone} />
        <Field label="Email" value={profile?.email} />
        <Field label="Preferred Language" value={profile?.preferredLanguage} />
        <Field label="State" value={profile?.domicileState} />
        <Field label="District" value={profile?.district} />
        <Field label="City" value={profile?.city} />
        <Field label="PIN Code" value={profile?.pinCode} />
      </div>
    </SectionCard>
  );
}

function AcademicSection({ profile }: { profile: any }) {
  return (
    <>
      <SectionCard title="Academic Information" editHref="/onboarding?step=2">
        <div className="profile-form-grid">
          <Field label="Current Qualification" value={profile?.academic?.currentQualification} />
          <Field label="10th Percentage" value={profile?.academic?.tenthPercentage} />
          <Field label="12th Percentage" value={profile?.academic?.twelfthPercentage} />
          <Field label="Diploma" value={profile?.academic?.diploma} />
          <Field label="PUC Board" value={profile?.academic?.pucBoard} />
          <Field label="Year of Passing" value={profile?.academic?.yearOfPassing} />
          <Field label="Gap Years" value={profile?.academic?.gapYears} />
        </div>
      </SectionCard>
      <SectionCard title="Exam Scores" editHref="/onboarding?step=3">
        {profile?.examProfiles?.length ? (
          <div className="profile-chip-row">
            {profile.examProfiles.map((e: any) => (
              <span key={e.examCode} className="profile-chip">
                {EXAM_LABELS[e.examCode] ?? e.examCode} · Rank {e.rank || '—'} · {e.year}
              </span>
            ))}
          </div>
        ) : (
          <p className="profile-empty-inline">No exam scores added yet.</p>
        )}
      </SectionCard>
    </>
  );
}

function PreferencesSection({ profile }: { profile: any }) {
  return (
    <>
      <SectionCard title="Category & Reservation" editHref="/onboarding?step=4">
        <div className="profile-chip-row">
          {profile?.categoryReservation?.reservationCategory && <span className="profile-chip">{profile.categoryReservation.reservationCategory}</span>}
          {profile?.categoryReservation?.horizontalReservations?.map((r: string) => <span key={r} className="profile-chip">{r}</span>)}
          {!profile?.categoryReservation?.reservationCategory && !profile?.categoryReservation?.horizontalReservations?.length && (
            <p className="profile-empty-inline">Not set yet.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Career Preferences" editHref="/onboarding?step=5">
        <div className="profile-form-grid">
          <Field label="Preferred Exam" value={profile?.preferences?.preferredExam} />
          <Field label="Preferred Discipline" value={profile?.preferences?.preferredDiscipline} />
          <Field label="College Type" value={profile?.preferences?.collegeType} />
          <Field label="Budget (Max)" value={profile?.preferences?.budgetMax ? `₹${profile.preferences.budgetMax.toLocaleString()}` : undefined} />
        </div>
        <div className="profile-chip-row">
          {(profile?.preferences?.preferredCourses ?? []).map((c: string) => <span key={c} className="profile-chip">{c}</span>)}
        </div>
      </SectionCard>

      <SectionCard title="AI Personalization" editHref="/onboarding?step=6">
        <div className="profile-form-grid">
          <Field label="Career Goal" value={profile?.aiPersonalization?.careerGoal} />
          <Field label="Learning Style" value={profile?.aiPersonalization?.learningStyle} />
          <Field label="Communication Language" value={profile?.aiPersonalization?.communicationLanguage} />
        </div>
        <div className="profile-chip-row">
          {(profile?.aiPersonalization?.skills ?? []).map((s: string) => <span key={s} className="profile-chip">{s}</span>)}
        </div>
      </SectionCard>
    </>
  );
}

function LinkOutSection({ title, description, cta, href, secondaryCta, secondaryHref }: { title: string; description: string; cta: string; href: string; secondaryCta?: string; secondaryHref?: string }) {
  return (
    <SectionCard title={title}>
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{description}</p>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Link href={href} className="btn-editorial-primary" style={{ textDecoration: 'none' }}>{cta}</Link>
        {secondaryCta && secondaryHref && (
          <Link href={secondaryHref} className="btn-editorial-secondary" style={{ textDecoration: 'none' }}>{secondaryCta}</Link>
        )}
      </div>
    </SectionCard>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="profile-page container-editorial"><p className="wizard-hint">Loading…</p></div>}>
      <ProfileContent />
    </Suspense>
  );
}
