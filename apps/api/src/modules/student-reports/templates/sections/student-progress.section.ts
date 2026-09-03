import { ReportSection } from '../report-data.types';

export interface StudentProgressInput {
  profileCompletionPercent: number;
  examsCount: number;
  savedCollegesCount: number;
  predictionsCount: number;
  scholarshipsEligibleCount: number;
  roadmapCompletionPercent: number;
  roadmapSkillScore: number | null;
  achievements: Array<{ label: string; earnedAt: string | Date }>;
  memberSince: Date | undefined;
}

export function buildStudentProgressSections(input: StudentProgressInput): { sections: ReportSection[]; aiSummary: string } {
  const {
    profileCompletionPercent, examsCount, savedCollegesCount, predictionsCount,
    scholarshipsEligibleCount, roadmapCompletionPercent, roadmapSkillScore, achievements, memberSince,
  } = input;

  const sections: ReportSection[] = [
    {
      key: 'progress-overview', title: 'Progress Overview', kind: 'keyValue',
      data: [
        { label: 'Profile Completion', value: `${profileCompletionPercent}%` },
        { label: 'Exam Profiles Added', value: String(examsCount) },
        { label: 'Saved Colleges', value: String(savedCollegesCount) },
        { label: 'Predictions Run', value: String(predictionsCount) },
        { label: 'Eligible Scholarships', value: String(scholarshipsEligibleCount) },
        { label: 'Career Roadmap Completion', value: `${roadmapCompletionPercent}%` },
        { label: 'Member Since', value: memberSince ? new Date(memberSince).toDateString() : 'N/A' },
      ],
    },
    {
      key: 'completion-chart', title: 'Completion Snapshot', kind: 'chart',
      data: {
        chartType: 'bar',
        data: [
          { label: 'Profile', value: profileCompletionPercent },
          { label: 'Roadmap', value: roadmapCompletionPercent },
          ...(roadmapSkillScore != null ? [{ label: 'Skill Score', value: roadmapSkillScore }] : []),
        ],
      },
    },
  ];

  if (achievements.length > 0) {
    sections.push({
      key: 'achievements', title: 'Achievement Badges', kind: 'table',
      data: {
        columns: ['Badge', 'Earned On'],
        rows: achievements.map(a => [a.label, new Date(a.earnedAt).toDateString()]),
      },
    });
  }

  const gaps: string[] = [];
  if (profileCompletionPercent < 100) gaps.push('completing your profile');
  if (savedCollegesCount === 0) gaps.push('saving colleges to your wishlist');
  if (predictionsCount === 0) gaps.push('running admission predictions');
  if (roadmapCompletionPercent === 0) gaps.push('starting your career roadmap');

  const aiSummary = `Your profile is ${profileCompletionPercent}% complete with ${examsCount} exam profile${examsCount === 1 ? '' : 's'}, ${savedCollegesCount} saved college${savedCollegesCount === 1 ? '' : 's'}, and ${predictionsCount} prediction${predictionsCount === 1 ? '' : 's'} run. `
    + `Your career roadmap is ${roadmapCompletionPercent}% complete. `
    + (gaps.length > 0 ? `To get the most out of CareerCompass AI, focus next on ${gaps.slice(0, 2).join(' and ')}.` : 'You are actively using every core module — keep up the momentum.');

  return { sections, aiSummary };
}
