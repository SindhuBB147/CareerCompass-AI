'use client';

import { useCallback, useEffect, useState } from 'react';
import { useUserAuth } from '../../contexts/UserAuthContext';
import { roadmapApi, type CareerSummary, type MilestoneStatus, type Roadmap } from '../../lib/roadmap-api';
import { ApiError } from '../../lib/api-client';
import { CareerPathSelector } from './components/CareerPathSelector';
import Journey3D from './components/Journey3D';
import { PhaseTimelineView } from './components/PhaseTimelineView';
import { KanbanView } from './components/KanbanView';
import { ChecklistView } from './components/ChecklistView';
import { AnalyticsView } from './components/AnalyticsView';
import { SkillsResourcesView } from './components/SkillsResourcesView';
import { CertificationsView } from './components/CertificationsView';
import { ProjectsView } from './components/ProjectsView';
import { PlacementPrepView } from './components/PlacementPrepView';
import { HigherStudiesView } from './components/HigherStudiesView';
import { AiMentorPanel } from './components/AiMentorPanel';
import { RoadmapPrintable } from './components/RoadmapPrintable';
import { ReportDownloadButton } from '../../components/ui/ReportDownloadButton';

type TabKey = 'timeline' | 'kanban' | 'checklist' | 'analytics' | 'skills' | 'certifications' | 'projects' | 'placement' | 'higher_studies' | 'mentor' | 'export';

function SignInPrompt() {
  return (
    <div className="card-editorial colleges-empty-state">
      <div className="colleges-empty-icon">🗺️</div>
      <h3 className="font-serif colleges-empty-title">Sign In to Build Your Roadmap</h3>
      <p className="text-body colleges-empty-desc">Your Career Roadmap is personalized from your profile, skills, and goals — sign in to generate yours.</p>
    </div>
  );
}

export default function RoadmapPage() {
  const { accessToken, isAuthenticated, isLoading: authLoading } = useUserAuth();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [careers, setCareers] = useState<CareerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('timeline');
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    roadmapApi.getRoadmap(accessToken)
      .then(data => {
        setRoadmap(data);
        if (!data) return roadmapApi.getCareers(accessToken).then(setCareers);
      })
      .catch(err => setError(err instanceof ApiError ? err.message : 'Could not load your roadmap.'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  const handleSelectCareer = useCallback(async (careerId: string) => {
    if (!accessToken) return;
    setSwitching(true);
    setError(null);
    try {
      const generated = await roadmapApi.generateRoadmap(accessToken, careerId);
      setRoadmap(generated);
      setTab('timeline');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not generate that roadmap.');
    } finally {
      setSwitching(false);
    }
  }, [accessToken]);

  const handleMilestoneUpdate = useCallback(async (milestoneKey: string, patch: { status?: MilestoneStatus; notes?: string }) => {
    if (!accessToken) return;
    const updated = await roadmapApi.updateMilestone(accessToken, milestoneKey, patch);
    setRoadmap(updated);
  }, [accessToken]);

  const handleShare = useCallback(async () => {
    if (!accessToken) return;
    const { shareToken } = await roadmapApi.enableShare(accessToken);
    const url = `${window.location.origin}/roadmap/shared/${shareToken}`;
    setShareUrl(url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
  }, [accessToken]);

  if (authLoading) return null;

  if (!isAuthenticated || !accessToken) {
    return (
      <div className="section-padding container-editorial">
        <SignInPrompt />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="section-padding container-editorial">
        <p className="text-body">Loading your roadmap…</p>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="section-padding container-editorial">
        <CareerPathSelector careers={careers} onSelect={handleSelectCareer} busy={switching} />
        {error && <p style={{ color: '#C0392B', marginTop: '16px' }}>{error}</p>}
      </div>
    );
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'timeline', label: 'Timeline' },
    { key: 'kanban', label: 'Kanban' },
    { key: 'checklist', label: 'Checklist' },
    { key: 'analytics', label: 'Analytics' },
    { key: 'skills', label: 'Skills & Resources' },
    { key: 'certifications', label: 'Certifications' },
    { key: 'projects', label: 'Projects' },
    { key: 'placement', label: 'Placement Prep' },
    ...(roadmap.phases.some(p => p.milestones.some(m => m.category === 'higher_studies')) ? [{ key: 'higher_studies' as const, label: 'Higher Studies' }] : []),
    { key: 'mentor', label: 'AI Mentor' },
    { key: 'export', label: 'Export' },
  ];

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <section className="roadmap-hero" style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '32px', borderBottom: '1px solid var(--border-color)' }}>
        <div className="hero-content" style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'flex-start' }}>
          <div className="hero-left" style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="hero-header" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'flex-end', gap: '16px' }}>
              <div>
                <h1 className="text-section-title font-serif">{roadmap.careerName}</h1>
                <p className="text-body" style={{ maxWidth: '640px' }}>Personalized from your profile — updated as you make progress.</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <ReportDownloadButton reportType="career_roadmap" tooltip="Download Roadmap" size="md" />
                <button type="button" className="btn-editorial-secondary" onClick={() => { setRoadmap(null); roadmapApi.getCareers(accessToken).then(setCareers); }}>
                  Switch Career
                </button>
              </div>
            </div>
            <div className="hero-progress" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="roadmap-progress-track" style={{ flex: '1 1 280px' }}>
                <div className="roadmap-progress-fill" style={{ width: `${roadmap.analytics.completionPercent}%` }} />
              </div>
              <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{roadmap.analytics.completionPercent}% complete · {roadmap.analytics.completedCount}/{roadmap.analytics.totalCount} milestones</span>
            </div>
            <div className="continue-card" style={{ padding: '12px 16px', background: 'var(--card-bg)', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
              <button className="btn-editorial-primary" onClick={() => { /* focus next tab */ setTab('timeline'); }}>
                Continue your journey
              </button>
            </div>
          </div>
          <div className="hero-right" style={{ flex: '1 1 400px', minHeight: '380px', maxHeight: '460px' }}>
            <Journey3D roadmap={roadmap} onMilestoneSelect={handleMilestoneUpdate} />
          </div>
        </div>
      </section>

      <div className="roadmap-tab-row financial-tab-row">
        {TABS.map(t => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={tab === t.key ? 'btn-editorial-primary' : 'btn-editorial-secondary'}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'timeline' && <PhaseTimelineView phases={roadmap.phases} onMilestoneUpdate={handleMilestoneUpdate} />}
      {tab === 'kanban' && <KanbanView phases={roadmap.phases} onMilestoneUpdate={handleMilestoneUpdate} />}
      {tab === 'checklist' && <ChecklistView phases={roadmap.phases} onMilestoneUpdate={handleMilestoneUpdate} />}
      {tab === 'analytics' && <AnalyticsView analytics={roadmap.analytics} />}
      {tab === 'skills' && <SkillsResourcesView phases={roadmap.phases} />}
      {tab === 'certifications' && <CertificationsView phases={roadmap.phases} />}
      {tab === 'projects' && <ProjectsView phases={roadmap.phases} />}
      {tab === 'placement' && <PlacementPrepView phases={roadmap.phases} onMilestoneUpdate={handleMilestoneUpdate} />}
      {tab === 'higher_studies' && <HigherStudiesView phases={roadmap.phases} onMilestoneUpdate={handleMilestoneUpdate} />}
      {tab === 'mentor' && <AiMentorPanel token={accessToken} />}
      {tab === 'export' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p className="text-body">Print your roadmap to PDF, or generate a read-only link to share with a mentor, parent, or counsellor.</p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button type="button" className="btn-editorial-primary" onClick={() => window.print()}>Print / Save as PDF</button>
            <button type="button" className="btn-editorial-secondary" onClick={handleShare}>Get Shareable Link</button>
          </div>
          {shareUrl && (
            <div className="card-editorial" style={{ padding: '18px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ fontSize: '14px' }}>{shareUrl}</code>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>(copied to clipboard)</span>
            </div>
          )}
        </div>
      )}

      <RoadmapPrintable roadmap={roadmap} />
    </div>
  );
}
