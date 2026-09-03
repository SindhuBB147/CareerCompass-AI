/**
 * Pure math and deterministic assessment for entrance cutoff eligibility,
 * SAFE/TARGET/DREAM portfolio classification, multi-criteria recommendation scoring,
 * and portfolio risk modes.
 */

export interface YearlyClosingRank {
  year: number;
  closingRank: number;
}

/** Configurable rank-ratio threshold defaults (product design configuration) */
export const SAFE_RATIO = 0.80;
export const TARGET_RATIO = 1.05;
export const DREAM_RATIO = 1.30;

export type PortfolioClassification =
  | 'SAFE'
  | 'TARGET'
  | 'DREAM'
  | 'OUTSIDE_HISTORICAL_RANGE'
  | 'INSUFFICIENT_DATA';

export type ProbabilityBand5 = 'Very High' | 'High' | 'Medium' | 'Low' | 'Very Low';
export type LegacyProbabilityBand = 'Safe' | 'Moderate' | 'Ambitious' | 'Reach';

/** Multi-Criteria Recommendation Scoring Weights (sum to 1.00) */
export const RECOMMENDATION_WEIGHTS = {
  eligibility: 0.30,
  branch: 0.20,
  location: 0.15,
  budget: 0.10,
  placement: 0.10,
  quality: 0.10,
  roi: 0.05,
};

export interface ScoreBreakdown {
  eligibility: number;
  branchMatch: number;
  location: number;
  budget: number;
  placement: number;
  collegeQuality: number;
  roi: number;
}

export interface MultiCriteriaScoreInput {
  studentRank: number;
  trendingClosingRank: number;
  isCourseMatch: boolean;
  isLocationMatch: boolean;
  feePerYear?: number | null;
  maxBudgetFilter?: number;
  placementAverage?: number | null;
  nirfRank?: number | null;
}

/** Risk Preference Portfolio Allocations (Configurable Product Defaults) */
export type RiskPreferenceMode = 'conservative' | 'balanced' | 'aggressive';

export interface PortfolioTargetMix {
  safePercentage: number;
  targetPercentage: number;
  dreamPercentage: number;
}

export const PORTFOLIO_RISK_MODES: Record<RiskPreferenceMode, PortfolioTargetMix> = {
  conservative: { safePercentage: 50, targetPercentage: 35, dreamPercentage: 15 },
  balanced: { safePercentage: 30, targetPercentage: 50, dreamPercentage: 20 },
  aggressive: { safePercentage: 15, targetPercentage: 40, dreamPercentage: 45 },
};

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

/**
 * Classifies a student rank relative to a reference historical closing rank
 * into a SAFE / TARGET / DREAM / OUTSIDE_HISTORICAL_RANGE portfolio category.
 */
export function classifyPortfolio(
  studentRank: number,
  referenceClosingRank: number,
): PortfolioClassification {
  if (!referenceClosingRank || referenceClosingRank <= 0 || !studentRank || studentRank <= 0) {
    return 'INSUFFICIENT_DATA';
  }

  // Top-rank absolute handling (ratios compress at ultra-high ranks <= 500)
  if (studentRank <= 500 && referenceClosingRank <= 500) {
    const diff = referenceClosingRank - studentRank;
    if (diff >= 100) return 'SAFE';
    if (diff >= -50) return 'TARGET';
    if (diff >= -150) return 'DREAM';
    return 'OUTSIDE_HISTORICAL_RANGE';
  }

  const ratio = studentRank / referenceClosingRank;
  if (ratio <= SAFE_RATIO) return 'SAFE';
  if (ratio <= TARGET_RATIO) return 'TARGET';
  if (ratio <= DREAM_RATIO) return 'DREAM';
  return 'OUTSIDE_HISTORICAL_RANGE';
}

/**
 * Calculates a continuous Recommendation Fit Score (1-99) based on rank position.
 * NOTE: This is a preference & suitability score for sorting, NOT a trained ML admission probability.
 */
export function recommendationScoreFromRatio(ratio: number): number {
  if (ratio <= 0) return 1;
  let score: number;

  if (ratio <= 0.55) score = 90 + Math.min(9, (0.55 - ratio) * 20);
  else if (ratio <= 0.80) score = 70 + ((0.80 - ratio) / 0.25) * 20;
  else if (ratio <= 1.05) score = 40 + ((1.05 - ratio) / 0.25) * 30;
  else if (ratio <= 1.30) score = 10 + ((1.30 - ratio) / 0.25) * 30;
  else score = Math.max(1, 10 - (ratio - 1.30) * 15);

  return Math.round(Math.min(99, Math.max(1, score)));
}

/**
 * Computes a multi-criteria recommendation fit score and detailed component breakdown.
 */
export function computeMultiCriteriaScore(input: MultiCriteriaScoreInput): {
  recommendationFitScore: number;
  scoreBreakdown: ScoreBreakdown;
} {
  const hasCutoffData = input.trendingClosingRank > 0;
  const ratio = hasCutoffData ? input.studentRank / input.trendingClosingRank : Infinity;
  const eligibility = hasCutoffData ? recommendationScoreFromRatio(ratio) : 0;
  const branchMatch = input.isCourseMatch ? 100 : 40;
  const location = input.isLocationMatch ? 100 : 60;

  let budget = 100;
  if (input.feePerYear && input.maxBudgetFilter) {
    if (input.feePerYear <= input.maxBudgetFilter * 0.8) budget = 100;
    else if (input.feePerYear <= input.maxBudgetFilter) budget = 85;
    else if (input.feePerYear <= input.maxBudgetFilter * 1.2) budget = 50;
    else budget = 20;
  }

  let placement = 30;
  if (input.placementAverage) {
    if (input.placementAverage >= 12) placement = 100;
    else if (input.placementAverage >= 8) placement = 85;
    else if (input.placementAverage >= 5) placement = 70;
    else placement = 40;
  }

  let collegeQuality = 40;
  if (input.nirfRank) {
    if (input.nirfRank <= 50) collegeQuality = 100;
    else if (input.nirfRank <= 100) collegeQuality = 85;
    else if (input.nirfRank <= 200) collegeQuality = 70;
  }

  let roi = 40;
  if (input.placementAverage && input.feePerYear && input.feePerYear > 0) {
    const roiRatio = input.placementAverage / (input.feePerYear / 100000);
    if (roiRatio >= 4.0) roi = 100;
    else if (roiRatio >= 2.5) roi = 85;
    else if (roiRatio >= 1.5) roi = 70;
  }

  const scoreBreakdown: ScoreBreakdown = {
    eligibility,
    branchMatch,
    location,
    budget,
    placement,
    collegeQuality,
    roi,
  };

  if (!hasCutoffData) {
    return { recommendationFitScore: 3, scoreBreakdown };
  }

  const weightedSum =
    eligibility * RECOMMENDATION_WEIGHTS.eligibility +
    branchMatch * RECOMMENDATION_WEIGHTS.branch +
    location * RECOMMENDATION_WEIGHTS.location +
    budget * RECOMMENDATION_WEIGHTS.budget +
    placement * RECOMMENDATION_WEIGHTS.placement +
    collegeQuality * RECOMMENDATION_WEIGHTS.quality +
    roi * RECOMMENDATION_WEIGHTS.roi;

  let recommendationFitScore = Math.round(Math.min(99, Math.max(1, weightedSum)));

  // If student rank is far outside the historical cutoff range (ratio > 1.30), dampen score
  if (ratio > DREAM_RATIO) {
    recommendationFitScore = Math.min(35, Math.round(recommendationFitScore * 0.4));
  }

  return { recommendationFitScore, scoreBreakdown };
}

/** Deprecated backwards-compatibility alias for recommendationScoreFromRatio */
export function probabilityPercentFromRatio(ratio: number): number {
  return recommendationScoreFromRatio(ratio);
}

export function bandFromPercent(percent: number): ProbabilityBand5 {
  if (percent >= 90) return 'Very High';
  if (percent >= 70) return 'High';
  if (percent >= 40) return 'Medium';
  if (percent >= 10) return 'Low';
  return 'Very Low';
}

export function legacyBandFromClassification(classification: PortfolioClassification): LegacyProbabilityBand {
  switch (classification) {
    case 'SAFE': return 'Safe';
    case 'TARGET': return 'Moderate';
    case 'DREAM': return 'Ambitious';
    default: return 'Reach';
  }
}

export function confidenceFromDataPoints(dataPoints: number): 'high' | 'medium' | 'low' {
  return dataPoints >= 3 ? 'high' : dataPoints >= 2 ? 'medium' : 'low';
}
