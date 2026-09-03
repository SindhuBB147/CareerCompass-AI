'use client';

import type { PhaseInstance, MilestoneStatus } from '../../../lib/roadmap-api';
import { MilestoneCard } from './MilestoneCard';

interface Props {
  phases: PhaseInstance[];
  onMilestoneUpdate: (milestoneKey: string, patch: { status?: MilestoneStatus; notes?: string }) => Promise<void>;
}

export function PlacementPrepView({ phases, onMilestoneUpdate }: Props) {
  const milestones = phases.flatMap(p => p.milestones).filter(m => m.category === 'placement' || m.category === 'competitive_programming' || m.category === 'hackathon');

  if (milestones.length === 0) {
    return <p className="text-body">No placement-prep milestones on this roadmap yet — they typically appear from Year 2 onward.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p className="text-body">Resume, LinkedIn, GitHub, coding practice, aptitude, and interview prep — pulled from across your roadmap.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {milestones.map(m => <MilestoneCard key={m.milestoneKey} milestone={m} onUpdate={onMilestoneUpdate} />)}
      </div>
    </div>
  );
}
