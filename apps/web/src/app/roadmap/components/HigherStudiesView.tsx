'use client';

import type { PhaseInstance, MilestoneStatus } from '../../../lib/roadmap-api';
import { MilestoneCard } from './MilestoneCard';

interface Props {
  phases: PhaseInstance[];
  onMilestoneUpdate: (milestoneKey: string, patch: { status?: MilestoneStatus; notes?: string }) => Promise<void>;
}

export function HigherStudiesView({ phases, onMilestoneUpdate }: Props) {
  const milestones = phases.flatMap(p => p.milestones).filter(m => m.category === 'higher_studies');

  if (milestones.length === 0) {
    return <p className="text-body">No higher-studies milestones on this roadmap. Set your post-graduation preference in your profile to include GATE/GRE/CAT prep guidance.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <p className="text-body">Entrance exams, university/program shortlisting, and application guidance.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {milestones.map(m => <MilestoneCard key={m.milestoneKey} milestone={m} onUpdate={onMilestoneUpdate} />)}
      </div>
    </div>
  );
}
