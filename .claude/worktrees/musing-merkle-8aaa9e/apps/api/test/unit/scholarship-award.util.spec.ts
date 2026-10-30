import { sumScholarshipSavings, ScholarshipAwardLike } from '../../src/modules/financial-planning/utils/scholarship-award.util';

function fixedAward(name: string, value: number): ScholarshipAwardLike {
  return { name, awardAmount: { type: 'fixed', value } };
}
function percentAward(name: string, value: number): ScholarshipAwardLike {
  return { name, awardAmount: { type: 'percentage', value } };
}

describe('scholarship-award.util', () => {
  it('sums a fixed-type award directly, independent of feeBase', () => {
    const result = sumScholarshipSavings([fixedAward('A', 20000)], 1000000);
    expect(result.scholarships[0].estimatedSavings).toBe(20000);
    expect(result.totalEstimatedSavings).toBe(20000);
  });

  it('computes a percentage-type award against the passed fee base', () => {
    const result = sumScholarshipSavings([percentAward('B', 25)], 400000);
    expect(result.scholarships[0].estimatedSavings).toBe(100000); // 25% of 400,000
    expect(result.totalEstimatedSavings).toBe(100000);
  });

  it('caps the total at the fee base when scholarships overshoot', () => {
    const result = sumScholarshipSavings(
      [percentAward('B', 70), percentAward('C', 60)], // 70% + 60% of feeBase would exceed 100%
      400000,
    );
    expect(result.totalEstimatedSavings).toBe(400000);
  });

  it('sums multiple non-overlapping fixed + percentage awards without over-capping', () => {
    const result = sumScholarshipSavings(
      [fixedAward('A', 20000), percentAward('B', 10)],
      400000,
    );
    // 20,000 + (10% of 400,000 = 40,000) = 60,000, well under the 400,000 cap
    expect(result.totalEstimatedSavings).toBe(60000);
  });

  it('returns 0 for an empty match list', () => {
    const result = sumScholarshipSavings([], 400000);
    expect(result.scholarships).toHaveLength(0);
    expect(result.totalEstimatedSavings).toBe(0);
  });
});
