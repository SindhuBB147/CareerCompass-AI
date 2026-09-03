'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUserAuth } from '../../../contexts/UserAuthContext';
import { memoryApi, MemorySummary, MemoryCategory, PersonalizationSettings } from '../../../lib/memory-api';
import { consentApi, ConsentState } from '../../../lib/consent-api';
import { acceptAllValue, rejectOptionalValue, setConsentCookie, CONSENT_POLICY_VERSION } from '../../../lib/cookie-consent';

export default function MemoryPrivacyPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();

  const [summary, setSummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    const data = await memoryApi.getSummary(accessToken);
    setSummary(data);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) { router.push('/login/student'); return; }
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated]);

  const runAction = async (key: string, fn: () => Promise<unknown>, successText: string) => {
    setBusyKey(key);
    setBanner(null);
    try {
      await fn();
      await load();
      setBanner({ tone: 'success', text: successText });
    } catch {
      setBanner({ tone: 'error', text: 'Something went wrong. Please try again.' });
    } finally {
      setBusyKey(null);
    }
  };

  const deleteCategory = (category: MemoryCategory, label: string) =>
    runAction(category, () => memoryApi.deleteCategory(category, accessToken), `${label} cleared.`);

  const updateToggle = (patch: Partial<PersonalizationSettings>) =>
    runAction('toggles', () => memoryApi.updatePersonalizationSettings(patch, accessToken), 'Personalization settings updated.');

  const updateConsent = (action: 'accept_all' | 'reject_optional', categories: Record<string, boolean>) =>
    runAction('consent', async () => {
      const value = action === 'accept_all' ? acceptAllValue() : rejectOptionalValue();
      setConsentCookie(value);
      await consentApi.update({ action, ...categories }, accessToken);
    }, 'Cookie preferences updated.');

  const withdrawConsent = () =>
    runAction('consent', async () => {
      setConsentCookie({ necessary: true, functional: false, analytics: false, preference: false, aiPersonalization: false, policyVersion: CONSENT_POLICY_VERSION });
      await consentApi.withdraw(accessToken);
    }, 'Consent withdrawn — optional cookies are now off.');

  const resetPersonalization = () =>
    runAction('reset', () => memoryApi.resetPersonalization(accessToken), 'Personalization has been reset to defaults.');

  const exportData = async () => {
    setBusyKey('export');
    try {
      const data = await memoryApi.exportData(accessToken);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `careercompass-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setBanner({ tone: 'error', text: 'Could not export your data. Please try again.' });
    } finally {
      setBusyKey(null);
    }
  };

  if (authLoading || loading || !summary) {
    return <div className="profile-page container-editorial"><p className="wizard-hint">Loading your memory & privacy settings…</p></div>;
  }

  return (
    <div className="profile-page container-editorial">
      <div className="wizard-header" style={{ textAlign: 'left', alignItems: 'flex-start' }}>
        <span className="auth-eyebrow">Account</span>
        <h1 className="text-section-title font-serif wizard-title">Memory & Privacy</h1>
        <p className="wizard-subtitle">
          Everything CareerCompass AI remembers about you — view it, export it, or delete it. Nothing here is
          fabricated; every value comes from something you did or told us.
        </p>
        <Link href="/profile/settings?section=privacy" className="profile-nav-item" style={{ marginTop: '8px' }}>← Back to Settings</Link>
      </div>

      {banner && <div className="auth-banner" data-tone={banner.tone} style={{ marginBottom: '20px' }}>{banner.text}</div>}

      <PersonalizationSection settings={summary.personalizationSettings} busyKey={busyKey} onToggle={updateToggle} onReset={resetPersonalization} />

      <ConsentSection consent={summary.consent} busyKey={busyKey} onAcceptAll={() => updateConsent('accept_all', { functional: true, analytics: true, preference: true, aiPersonalization: true })} onRejectOptional={() => updateConsent('reject_optional', { functional: false, analytics: false, preference: false, aiPersonalization: false })} onWithdraw={withdrawConsent} />

      <MemoryCategorySection
        title="Profile Memory"
        description="Explicit answers you gave during onboarding — edit these from your Profile page, not here."
        readOnly
      >
        {summary.profile ? (
          <dl className="memory-kv-list">
            <Kv label="Name" value={summary.profile.fullName} />
            <Kv label="Preferred language" value={summary.profile.preferredLanguage} />
            <Kv label="Preferred theme" value={summary.profile.preferredTheme} />
            <Kv label="Preferred exam" value={summary.profile.preferredExam} />
            <Kv label="Preferred courses" value={summary.profile.preferredCourses?.join(', ')} />
            <Kv label="Preferred colleges" value={summary.profile.preferredColleges?.join(', ')} />
            <Kv label="Preferred location" value={summary.profile.preferredLocation?.join(', ')} />
            <Kv label="Budget" value={summary.profile.budgetMax ? `₹${summary.profile.budgetMax.toLocaleString('en-IN')}` : undefined} />
            <Kv label="Career goal" value={summary.profile.careerGoal} />
            <Kv label="Current semester" value={summary.profile.currentSemester?.toString()} />
            <Kv label="Current college" value={summary.profile.currentCollege} />
          </dl>
        ) : <EmptyState text="No profile data yet." />}
      </MemoryCategorySection>

      <MemoryCategorySection
        title="AI Conversation Memory"
        description="What the AI Counsellor has picked up across your conversations, plus your session history."
        onDelete={() => deleteCategory('aiMemorySlots', 'Remembered conversation context')}
        deleteLabel="Forget remembered context"
        busy={busyKey === 'aiMemorySlots'}
        secondaryAction={{ label: 'Delete all conversation history', onClick: () => deleteCategory('conversationHistory', 'Conversation history'), busy: busyKey === 'conversationHistory' }}
      >
        {Object.values(summary.aiConversationMemory.rememberedSlots).some(Boolean) ? (
          <dl className="memory-kv-list">
            <Kv label="Course" value={summary.aiConversationMemory.rememberedSlots.discipline} />
            <Kv label="City" value={summary.aiConversationMemory.rememberedSlots.city} />
            <Kv label="Exam" value={summary.aiConversationMemory.rememberedSlots.examCode} />
            <Kv label="Budget" value={summary.aiConversationMemory.rememberedSlots.budgetMax ? `₹${summary.aiConversationMemory.rememberedSlots.budgetMax}` : undefined} />
          </dl>
        ) : <EmptyState text="Nothing remembered yet — start a conversation with the AI Counsellor." />}
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>
          {summary.aiConversationMemory.sessions.length} saved conversation{summary.aiConversationMemory.sessions.length === 1 ? '' : 's'}.
        </p>
      </MemoryCategorySection>

      <MemoryCategorySection
        title="Search Memory"
        description="Recent and saved searches on Smart Search."
        onDelete={() => deleteCategory('searchHistory', 'Search history')}
        deleteLabel="Clear search history"
        busy={busyKey === 'searchHistory'}
      >
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {summary.searchMemory.recentSearches.length} recent, {summary.searchMemory.savedSearches.length} saved.
        </p>
      </MemoryCategorySection>

      <MemoryCategorySection
        title="Recommendation Memory"
        description="Colleges you've saved or recently viewed."
        onDelete={() => deleteCategory('recentlyViewedColleges', 'Recently viewed colleges')}
        deleteLabel="Clear recently viewed"
        busy={busyKey === 'recentlyViewedColleges'}
      >
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {(summary.recommendationMemory.saved as any)?.colleges?.length ?? 0} saved, {summary.recommendationMemory.recentlyViewed.length} recently viewed.
          Manage saved colleges from your <Link href="/wishlist">Wishlist</Link>.
        </p>
      </MemoryCategorySection>

      <MemoryCategorySection title="Admission Predictor Memory" description="Your cached prediction runs — rerun any of these without re-entering your details." readOnly>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {summary.admissionPredictorMemory.predictions.length} prediction{summary.admissionPredictorMemory.predictions.length === 1 ? '' : 's'} on file.
        </p>
      </MemoryCategorySection>

      <MemoryCategorySection
        title="Financial Planner Memory"
        description="Your last budget, loan, and cost-comparison calculations."
        onDelete={() => deleteCategory('financialPlanHistory', 'Financial planning history')}
        deleteLabel="Clear calculation history"
        busy={busyKey === 'financialPlanHistory'}
      >
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {summary.financialPlannerMemory.history.length} saved calculation{summary.financialPlannerMemory.history.length === 1 ? '' : 's'}.
        </p>
      </MemoryCategorySection>

      <MemoryCategorySection
        title="Scholarship Memory"
        description="Scholarships you've viewed, saved, applied to, or checked eligibility for."
        onDelete={() => deleteCategory('scholarshipInteractions', 'Scholarship interaction history')}
        deleteLabel="Clear interaction history"
        busy={busyKey === 'scholarshipInteractions'}
      >
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          {summary.scholarshipMemory.bookmarks.length} saved, {summary.scholarshipMemory.interactions.length} interactions recorded.
        </p>
      </MemoryCategorySection>

      <MemoryCategorySection title="Career Roadmap Memory" description="Your milestone progress, achievements, and skill score." readOnly>
        {summary.careerRoadmapMemory ? (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
            {summary.careerRoadmapMemory.careerName} — {(summary.careerRoadmapMemory.analytics as any)?.completionPercent ?? 0}% complete.
          </p>
        ) : <EmptyState text="No roadmap generated yet." />}
      </MemoryCategorySection>

      <MemoryCategorySection
        title="Session State"
        description="Restores your last dashboard, filters, sort order, and theme when you return."
        onDelete={() => deleteCategory('sessionState', 'Session state')}
        deleteLabel="Clear restored session"
        busy={busyKey === 'sessionState'}
      >
        <EmptyState text={summary.sessionState ? 'Session state is saved.' : 'Nothing saved yet.'} />
      </MemoryCategorySection>

      <div className="card-editorial profile-section-card">
        <h2 className="profile-section-title">Export Your Data</h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
          Download everything above as a single JSON file.
        </p>
        <button type="button" className="btn-editorial-secondary" style={{ alignSelf: 'flex-start' }} disabled={busyKey === 'export'} onClick={exportData}>
          {busyKey === 'export' ? 'Preparing…' : 'Export my data'}
        </button>
      </div>
    </div>
  );
}

function Kv({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '13px' }}>
      <dt style={{ color: 'var(--text-secondary)' }}>{label}</dt>
      <dd style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500, textAlign: 'right' }}>{value}</dd>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>{text}</p>;
}

function MemoryCategorySection({
  title, description, children, readOnly, onDelete, deleteLabel, busy, secondaryAction,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  readOnly?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  busy?: boolean;
  secondaryAction?: { label: string; onClick: () => void; busy?: boolean };
}) {
  return (
    <div className="card-editorial profile-section-card" style={{ marginBottom: '16px' }}>
      <div className="profile-section-title-row">
        <h2 className="profile-section-title">{title}</h2>
      </div>
      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{description}</p>
      {children}
      {!readOnly && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {onDelete && (
            <button type="button" className="btn-editorial-secondary" disabled={busy} onClick={onDelete} style={{ borderColor: '#B4232E', color: '#B4232E' }}>
              {busy ? 'Clearing…' : deleteLabel}
            </button>
          )}
          {secondaryAction && (
            <button type="button" className="btn-editorial-secondary" disabled={secondaryAction.busy} onClick={secondaryAction.onClick} style={{ borderColor: '#B4232E', color: '#B4232E' }}>
              {secondaryAction.busy ? 'Clearing…' : secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PersonalizationSection({
  settings, busyKey, onToggle, onReset,
}: {
  settings: PersonalizationSettings | null;
  busyKey: string | null;
  onToggle: (patch: Partial<PersonalizationSettings>) => void;
  onReset: () => void;
}) {
  if (!settings) return null;
  return (
    <div className="card-editorial profile-section-card" style={{ marginBottom: '16px' }}>
      <h2 className="profile-section-title">Personalization</h2>
      <div className="notif-pref-row-toggle">
        <span>AI personalization (recommendations, dashboard widgets, notification priority)</span>
        <input type="checkbox" checked={settings.aiPersonalizationEnabled} disabled={busyKey === 'toggles'} onChange={e => onToggle({ aiPersonalizationEnabled: e.target.checked })} />
      </div>
      <div className="notif-pref-row-toggle">
        <span>AI conversation memory (remember context across chats)</span>
        <input type="checkbox" checked={settings.conversationMemoryEnabled} disabled={busyKey === 'toggles'} onChange={e => onToggle({ conversationMemoryEnabled: e.target.checked })} />
      </div>
      <div className="notif-pref-row-toggle">
        <span>Search history</span>
        <input type="checkbox" checked={settings.searchHistoryEnabled} disabled={busyKey === 'toggles'} onChange={e => onToggle({ searchHistoryEnabled: e.target.checked })} />
      </div>
      <button type="button" className="btn-editorial-secondary" style={{ alignSelf: 'flex-start' }} disabled={busyKey === 'reset'} onClick={onReset}>
        {busyKey === 'reset' ? 'Resetting…' : 'Reset personalization to defaults'}
      </button>
    </div>
  );
}

function ConsentSection({
  consent, busyKey, onAcceptAll, onRejectOptional, onWithdraw,
}: {
  consent: ConsentState;
  busyKey: string | null;
  onAcceptAll: () => void;
  onRejectOptional: () => void;
  onWithdraw: () => void;
}) {
  return (
    <div className="card-editorial profile-section-card" style={{ marginBottom: '16px' }}>
      <h2 className="profile-section-title">Cookies & Consent</h2>
      <dl className="memory-kv-list">
        <Kv label="Necessary" value="Always on" />
        <Kv label="Functional" value={consent.functional ? 'On' : 'Off'} />
        <Kv label="Analytics" value={consent.analytics ? 'On' : 'Off'} />
        <Kv label="Preference" value={consent.preference ? 'On' : 'Off'} />
        <Kv label="AI Personalization" value={consent.aiPersonalization ? 'On' : 'Off'} />
      </dl>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-editorial-primary" disabled={busyKey === 'consent'} onClick={onAcceptAll}>Accept all</button>
        <button type="button" className="btn-editorial-secondary" disabled={busyKey === 'consent'} onClick={onRejectOptional}>Reject optional</button>
        <button type="button" className="btn-editorial-secondary" disabled={busyKey === 'consent'} onClick={onWithdraw} style={{ borderColor: '#B4232E', color: '#B4232E' }}>
          Withdraw consent
        </button>
      </div>
    </div>
  );
}
