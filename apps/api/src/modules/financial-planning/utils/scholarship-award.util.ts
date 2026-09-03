import { ROI_DEFAULTS } from './financial-config';

export interface ScholarshipAwardLike {
  name: string;
  awardAmount: { type: 'fixed' | 'percentage'; value: number; displayText?: string };
}

export interface ScholarshipSavingsLine {
  name: string;
  type: 'fixed' | 'percentage';
  value: number;
  estimatedSavings: number;
}

export interface ScholarshipSavingsResult {
  scholarships: ScholarshipSavingsLine[];
  /** Sum of scholarships[].estimatedSavings, capped at feeBase. */
  totalEstimatedSavings: number;
}

/**
 * Sums estimated scholarship savings against a fee base, handling both
 * fixed-₹ and percentage-of-fee award types. Percentage awards apply
 * against `feeBase` (the tuition/academic fee total) only — scholarships
 * are fee waivers, not living-expense stipends. The total is capped at
 * `feeBase` so stacked scholarships can never drive net cost negative.
 *
 * Shared by ScholarshipSavingsService and PredictionService.getRoi() so
 * the fixed/percentage/cap rule never drifts between the two call sites —
 * a pure function (not an Injectable) specifically so PredictionService
 * can import it directly without a circular module dependency on the
 * financial-planning module.
 */
export function sumScholarshipSavings(
  matches: ScholarshipAwardLike[],
  feeBase: number,
): ScholarshipSavingsResult {
  const cap = feeBase * (ROI_DEFAULTS.scholarshipCapPctOfFee / 100);

  const scholarships: ScholarshipSavingsLine[] = matches.map(s => {
    const estimatedSavings = s.awardAmount.type === 'fixed'
      ? s.awardAmount.value
      : (s.awardAmount.value / 100) * feeBase;
    return {
      name: s.name,
      type: s.awardAmount.type,
      value: s.awardAmount.value,
      estimatedSavings: Math.round(estimatedSavings),
    };
  });

  const rawTotal = scholarships.reduce((sum, s) => sum + s.estimatedSavings, 0);
  const totalEstimatedSavings = Math.round(Math.min(rawTotal, Math.max(0, cap)));

  return { scholarships, totalEstimatedSavings };
}
