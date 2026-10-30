import { ReportSection } from '../report-data.types';

export interface AiRecommendedCollege {
  collegeName: string;
  courseName: string;
  band: string;
  probabilityPercent: number;
  roiPercent: number | null;
}

export interface AiRecommendedScholarship {
  name: string;
  tierLabel: string;
  awardDisplay: string;
}

export interface AiRecommendationInput {
  colleges: AiRecommendedCollege[];
  scholarships: AiRecommendedScholarship[];
  nextMilestone: { title: string; estimatedWeeks: number } | null;
}

export function buildAiRecommendationSections(input: AiRecommendationInput): { sections: ReportSection[]; aiSummary: string } {
  const { colleges, scholarships, nextMilestone } = input;

  const sections: ReportSection[] = [
    {
      key: 'recommended-colleges', title: 'Recommended Colleges', kind: 'table',
      data: {
        columns: ['College', 'Course', 'Band', 'Probability', 'ROI %'],
        rows: colleges.map(c => [c.collegeName, c.courseName, c.band, `${c.probabilityPercent}%`, c.roiPercent ?? 'N/A']),
      },
    },
    {
      key: 'recommended-scholarships', title: 'Recommended Scholarships', kind: 'table',
      data: {
        columns: ['Scholarship', 'Match Tier', 'Award'],
        rows: scholarships.map(s => [s.name, s.tierLabel, s.awardDisplay]),
      },
    },
    {
      key: 'recommendation-mix', title: 'Recommendation Mix', kind: 'chart',
      data: {
        chartType: 'donut',
        data: [
          { label: 'Colleges', value: colleges.length },
          { label: 'Scholarships', value: scholarships.length },
        ],
      },
    },
  ];

  const parts: string[] = [];
  if (colleges.length > 0) parts.push(`your top recommended college is ${colleges[0].collegeName} (${colleges[0].band} band, ${colleges[0].probabilityPercent}% probability)`);
  if (scholarships.length > 0) parts.push(`${scholarships.length} matching scholarship${scholarships.length === 1 ? '' : 's'} were found, led by ${scholarships[0].name}`);
  if (nextMilestone) parts.push(`your next roadmap milestone is "${nextMilestone.title}" (~${nextMilestone.estimatedWeeks} week${nextMilestone.estimatedWeeks === 1 ? '' : 's'})`);

  const aiSummary = parts.length > 0
    ? `Based on your profile, ${parts.join('; ')}.`
    : 'Run a prediction, check your scholarship matches, or generate a career roadmap to unlock personalized recommendations.';

  return { sections, aiSummary };
}
