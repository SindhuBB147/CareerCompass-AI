'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { roadmapApi, type SharedRoadmap } from '../../../../lib/roadmap-api';
import { ApiError } from '../../../../lib/api-client';
import { CATEGORY_LABELS, STATUS_COLORS, STATUS_LABELS } from '../../roadmap-helpers';

export default function SharedRoadmapPage() {
  const params = useParams<{ token: string }>();
  const [roadmap, setRoadmap] = useState<SharedRoadmap | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    roadmapApi.getShared(params.token)
      .then(setRoadmap)
      .catch(err => setError(err instanceof ApiError ? err.message : 'This shared roadmap link is invalid or has been disabled.'));
  }, [params.token]);

  if (error) {
    return (
      <div className="section-padding container-editorial">
        <p className="text-body">{error}</p>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="section-padding container-editorial">
        <p className="text-body">Loading shared roadmap…</p>
      </div>
    );
  }

  return (
    <div className="section-padding container-editorial" style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '32px' }}>
        <span style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-blue)', fontWeight: 600 }}>Shared Roadmap (Read-Only)</span>
        <h1 className="text-section-title font-serif">{roadmap.careerName}</h1>
        <p className="text-body">{roadmap.analytics.completionPercent}% complete · {roadmap.analytics.completedCount}/{roadmap.analytics.totalCount} milestones · Generated {new Date(roadmap.generatedAt).toLocaleDateString('en-IN')}</p>
      </div>

      <div className="roadmap-timeline">
        {roadmap.phases.map((phase, idx) => (
          <div key={phase.phaseKey} className="roadmap-timeline-phase">
            <div className="roadmap-timeline-marker">
              <div className="roadmap-timeline-dot">{idx + 1}</div>
              {idx < roadmap.phases.length - 1 && <div className="roadmap-timeline-line" />}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '36px' }}>
              <h3 className="font-serif" style={{ fontSize: '22px', margin: 0 }}>{phase.label}</h3>
              {phase.milestones.map(m => (
                <div key={m.title} className="card-editorial" style={{ padding: '18px', display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge-editorial" style={{ marginBottom: '6px', display: 'inline-block' }}>{CATEGORY_LABELS[m.category]}</span>
                    <h4 className="font-serif" style={{ fontSize: '16px', margin: '4px 0' }}>{m.title}</h4>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>{m.description}</p>
                  </div>
                  <span className="roadmap-status-pill" style={{ color: STATUS_COLORS[m.status], borderColor: STATUS_COLORS[m.status], flexShrink: 0 }}>{STATUS_LABELS[m.status]}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
