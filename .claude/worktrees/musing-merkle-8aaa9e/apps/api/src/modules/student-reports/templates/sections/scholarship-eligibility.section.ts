import { ScholarshipRecommendation } from '../../../scholarships/services/recommendation.service';
import { ScholarshipDocument } from '../../../scholarships/models/scholarship.model';
import { ReportSection } from '../report-data.types';

function awardText(s: ScholarshipDocument): string {
  return s.awardAmount.type === 'percentage' ? `${s.awardAmount.value}% fee waiver` : `₹${s.awardAmount.value.toLocaleString('en-IN')}`;
}

function awardAmountRupees(s: ScholarshipDocument, academicFeeBasis = 100_000): number {
  return s.awardAmount.type === 'percentage' ? Math.round((s.awardAmount.value / 100) * academicFeeBasis) : s.awardAmount.value;
}

export function buildScholarshipEligibilitySections(input: {
  recommendations: ScholarshipRecommendation[];
  bookmarks: ScholarshipDocument[];
}): { sections: ReportSection[]; aiSummary: string } {
  const { recommendations, bookmarks } = input;

  const sections: ReportSection[] = [
    {
      key: 'recommended', title: 'Eligible & Recommended Scholarships', kind: 'table',
      data: {
        columns: ['Scholarship', 'Provider', 'Award', 'Deadline', 'Eligibility Score', 'Recommendation Tier'],
        rows: recommendations.map(r => [
          r.scholarship.name, r.scholarship.providerName ?? r.scholarship.provider,
          awardText(r.scholarship), new Date(r.scholarship.applicationDeadline).toDateString(),
          r.eligibility.score, r.tierLabel,
        ]),
      },
    },
    {
      key: 'tier-distribution', title: 'Recommendation Tiers', kind: 'chart',
      data: {
        chartType: 'donut',
        data: Object.entries(
          recommendations.reduce<Record<string, number>>((acc, r) => { acc[r.tierLabel] = (acc[r.tierLabel] ?? 0) + 1; return acc; }, {}),
        ).map(([label, value]) => ({ label, value })),
      },
    },
  ];

  for (const r of recommendations.slice(0, 15)) {
    sections.push({
      key: `eligibility-${r.scholarship.id}`, title: `Eligibility Detail — ${r.scholarship.name}`, kind: 'table',
      data: {
        columns: ['Check', 'Result', 'Detail'],
        rows: r.eligibility.checks.map(c => [c.label, c.result, c.message]),
      },
    });
  }

  if (bookmarks.length > 0) {
    sections.push({
      key: 'bookmarked', title: 'Bookmarked Scholarships', kind: 'table',
      data: {
        columns: ['Scholarship', 'Provider', 'Award', 'Deadline', 'Official Website'],
        rows: bookmarks.map(s => [s.name, s.providerName ?? s.provider, awardText(s), new Date(s.applicationDeadline).toDateString(), s.links?.officialWebsite ?? 'N/A']),
      },
    });
  }

  const totalPotentialSavings = recommendations.reduce((sum, r) => sum + awardAmountRupees(r.scholarship), 0);
  const eligibleCount = recommendations.filter(r => r.eligibility.verdict === 'eligible').length;
  const topRecommendation = recommendations.find(r => r.tier === 'highly_recommended') ?? recommendations[0];

  const aiSummary = recommendations.length > 0
    ? `You are fully eligible for ${eligibleCount} of ${recommendations.length} matched scholarships, with an estimated combined potential value of ₹${totalPotentialSavings.toLocaleString('en-IN')}. `
      + (topRecommendation ? `${topRecommendation.scholarship.name} is your top-ranked opportunity — apply before ${new Date(topRecommendation.scholarship.applicationDeadline).toDateString()}.` : '')
    : 'No scholarships currently match your profile. Complete your profile (category, income, exam details) to improve matching.';

  return { sections, aiSummary };
}
