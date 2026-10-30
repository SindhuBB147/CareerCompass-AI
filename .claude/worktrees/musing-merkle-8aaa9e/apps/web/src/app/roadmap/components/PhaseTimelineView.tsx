'use client';

import type { PhaseInstance, MilestoneStatus } from '../../../lib/roadmap-api';
import { MilestoneCard } from './MilestoneCard';

interface Props {
  phases: PhaseInstance[];
  onMilestoneUpdate: (milestoneKey: string, patch: { status?: MilestoneStatus; notes?: string }) => Promise<void>;
}

function phaseProgress(phase: PhaseInstance): number {
  if (phase.milestones.length === 0) return 0;
  const completed = phase.milestones.filter(m => m.status === 'completed').length;
  return Math.round((completed / phase.milestones.length) * 100);
}

export function PhaseTimelineView({ phases, onMilestoneUpdate }: Props) {
  return (
    <div className="roadmap-timeline">
      {phases.map((phase, idx) => (
        <div key={phase.phaseKey} className="roadmap-timeline-phase">
          <div className="roadmap-timeline-marker">
            <div className="roadmap-timeline-dot" data-complete={phaseProgress(phase) === 100}>{idx + 1}</div>
            {idx < phases.length - 1 && <div className="roadmap-timeline-line" />}
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <h3 className="font-serif" style={{ fontSize: '24px', margin: 0 }}>{phase.label}</h3>
              <div className="roadmap-progress-track" style={{ maxWidth: '160px' }}>
                <div className="roadmap-progress-fill" style={{ width: `${phaseProgress(phase)}%` }} />
              </div>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{phaseProgress(phase)}% complete</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {phase.milestones.map(m => (
                <MilestoneCard key={m.milestoneKey} milestone={m} onUpdate={onMilestoneUpdate} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
