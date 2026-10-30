import { ReportSection } from '../report-data.types';

export interface CareerRoadmapMilestoneInput {
  title: string;
  category: string;
  status: string;
  estimatedWeeks: number;
}

export interface CareerRoadmapPhaseInput {
  label: string;
  order: number;
  milestones: CareerRoadmapMilestoneInput[];
}

export interface CareerRoadmapInput {
  careerName: string;
  completionPercent: number;
  skillScore: number;
  completedCount: number;
  totalCount: number;
  phases: CareerRoadmapPhaseInput[];
  achievements: Array<{ label: string; earnedAt: Date }>;
}

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed', missed: 'Missed',
};

export function buildCareerRoadmapSections(input: CareerRoadmapInput): { sections: ReportSection[]; aiSummary: string } {
  const { careerName, completionPercent, skillScore, completedCount, totalCount, achievements } = input;
  const orderedPhases = [...input.phases].sort((a, b) => a.order - b.order);

  const sections: ReportSection[] = [
    {
      key: 'roadmap-overview', title: 'Career Roadmap Overview', kind: 'keyValue',
      data: [
        { label: 'Career Track', value: careerName },
        { label: 'Overall Completion', value: `${completionPercent}%` },
        { label: 'Skill Score', value: String(skillScore) },
        { label: 'Milestones Completed', value: `${completedCount} of ${totalCount}` },
      ],
    },
    {
      key: 'phase-progress', title: 'Progress by Phase', kind: 'chart',
      data: {
        chartType: 'bar',
        data: orderedPhases.map(phase => {
          const total = phase.milestones.length;
          const done = phase.milestones.filter(m => m.status === 'completed').length;
          return { label: phase.label, value: total > 0 ? Math.round((done / total) * 100) : 0 };
        }),
      },
    },
    {
      key: 'milestones', title: 'Milestone Plan', kind: 'table',
      data: {
        columns: ['Phase', 'Milestone', 'Category', 'Status', 'Est. Weeks'],
        rows: orderedPhases.flatMap(phase => phase.milestones.map(m => [
          phase.label, m.title, m.category, STATUS_LABELS[m.status] ?? m.status, m.estimatedWeeks,
        ])),
      },
    },
  ];

  if (achievements.length > 0) {
    sections.push({
      key: 'achievements', title: 'Achievement Badges', kind: 'table',
      data: { columns: ['Badge', 'Earned On'], rows: achievements.map(a => [a.label, new Date(a.earnedAt).toDateString()]) },
    });
  }

  const nextMilestone = orderedPhases.flatMap(p => p.milestones).find(m => m.status === 'not_started' || m.status === 'in_progress');
  const aiSummary = `Your ${careerName} roadmap is ${completionPercent}% complete (${completedCount} of ${totalCount} milestones), with a skill score of ${skillScore}. `
    + (nextMilestone
      ? `Focus next on "${nextMilestone.title}" (~${nextMilestone.estimatedWeeks} week${nextMilestone.estimatedWeeks === 1 ? '' : 's'}).`
      : 'All milestones are complete — consider generating a new roadmap for your next goal.');

  return { sections, aiSummary };
}
