/**
 * Shared pure math for admission-probability prediction. Extracted so the
 * legacy single-college 4-band path (`PredictionService`, used by the AI
 * Counsellor and choice-filling optimizer) and the new multi-college 5-band
 * predictor (`PredictionEngineService`) compute trending closing rank
 * identically instead of duplicating the weighting logic.
 */

export interface YearlyClosingRank {
  year: number;
  closingRank: number;
}

/** Weighted average closing rank — most recent year weight 3, second 2, older 1. */
export function computeTrendingClosingRank(data: YearlyClosingRank[]): number {
  if (data.length === 0) return 0;
  if (data.length === 1) return data[0].closingRank;

  const sorted = [...data].sort((a, b) => b.year - a.year);
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < sorted.length; i++) {
    const weight = i === 0 ? 3 : i === 1 ? 2 : 1;
    weightedSum += sorted[i].closingRank * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight);
}

export type ProbabilityBand5 = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';

/**
 * Continuous ratio → percent curve (studentRank / trendingClosingRank; a
 * lower ratio means the student's rank is better than the trend). Band is
 * derived separately from the *final* percent (after any bonus adjustment)
 * via `bandFromPercent`, so percent and band never disagree.
 */
export function probabilityPercentFromRatio(ratio: number): number {
  let percent: number;
  if (ratio <= 0.55) percent = 90 + Math.min(9, (0.55 - ratio) * 20);
  else if (ratio <= 0.8) percent = 70 + ((0.8 - ratio) / 0.25) * 20;
  else if (ratio <= 1.0) percent = 40 + ((1.0 - ratio) / 0.2) * 30;
  else if (ratio <= 1.25) percent = 10 + ((1.25 - ratio) / 0.25) * 30;
  else percent = Math.max(1, 10 - (ratio - 1.25) * 15);

  return Math.round(Math.min(99, Math.max(1, percent)));
}

export function bandFromPercent(percent: number): ProbabilityBand5 {
  if (percent >= 90) return 'Very High';
  if (percent >= 70) return 'High';
  if (percent >= 40) return 'Medium';
  if (percent >= 10) return 'Low';
  return 'Very Low';
}

export function confidenceFromDataPoints(dataPoints: number): 'high' | 'medium' | 'low' {
  return dataPoints >= 3 ? 'high' : dataPoints >= 2 ? 'medium' : 'low';
}
