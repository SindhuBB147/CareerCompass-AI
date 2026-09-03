import {
  computeMultiCriteriaScore,
  RECOMMENDATION_WEIGHTS,
  PORTFOLIO_RISK_MODES,
} from '../../src/modules/predictions/utils/prediction-math.util';
import { ComedkCutoffAdapter, KcetCutoffAdapter } from '../../src/modules/cutoffs/adapters/comedk-cutoff.adapter';

describe('P1 Recommendation Model, Component Breakdown & Optimizer', () => {
  describe('Multi-Criteria Scoring Formula & Component Breakdown', () => {
    it('computes weighted recommendationFitScore and detailed breakdown', () => {
      const input = {
        studentRank: 5000,
        trendingClosingRank: 10000, // ratio = 0.50 (SAFE)
        isCourseMatch: true,
        isLocationMatch: true,
        feePerYear: 200000,
        maxBudgetFilter: 300000,
        placementAverage: 10, // LPA
        nirfRank: 45, // Top 50
      };

      const { recommendationFitScore, scoreBreakdown } = computeMultiCriteriaScore(input);

      expect(recommendationFitScore).toBeGreaterThanOrEqual(85);
      expect(scoreBreakdown.eligibility).toBeGreaterThanOrEqual(90);
      expect(scoreBreakdown.branchMatch).toBe(100);
      expect(scoreBreakdown.location).toBe(100);
      expect(scoreBreakdown.budget).toBe(100);
      expect(scoreBreakdown.placement).toBe(85);
      expect(scoreBreakdown.collegeQuality).toBe(100);
      expect(scoreBreakdown.roi).toBe(100);
    });

    it('penalizes score when location, branch, or budget fail to match', () => {
      const highFit = computeMultiCriteriaScore({
        studentRank: 5000, trendingClosingRank: 10000, isCourseMatch: true, isLocationMatch: true,
      });

      const lowFit = computeMultiCriteriaScore({
        studentRank: 5000, trendingClosingRank: 10000, isCourseMatch: false, isLocationMatch: false,
      });

      expect(highFit.recommendationFitScore).toBeGreaterThan(lowFit.recommendationFitScore);
      expect(lowFit.scoreBreakdown.branchMatch).toBe(40);
      expect(lowFit.scoreBreakdown.location).toBe(60);
    });

    it('verifies that scoring weights sum to 1.00', () => {
      const sum = Object.values(RECOMMENDATION_WEIGHTS).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.00, 5);
    });
  });

  describe('Configurable Risk Preference Modes', () => {
    it('provides distinct portfolio mix targets for conservative, balanced, and aggressive modes', () => {
      expect(PORTFOLIO_RISK_MODES.conservative.safePercentage).toBe(50);
      expect(PORTFOLIO_RISK_MODES.balanced.targetPercentage).toBe(50);
      expect(PORTFOLIO_RISK_MODES.aggressive.dreamPercentage).toBe(45);
    });
  });

  describe('Multi-Exam Adapter Foundation', () => {
    it('identifies COMEDK adapter as ready for eligibility and not ready for ML', () => {
      const comedk = new ComedkCutoffAdapter();
      expect(comedk.examCode).toBe('COMEDK');
      expect(comedk.isReadyForEligibility()).toBe(true);
      expect(comedk.isReadyForML()).toBe(false);
    });

    it('identifies KCET adapter as unready for eligibility without real dataset', () => {
      const kcet = new KcetCutoffAdapter();
      const hasRawDataSpy = jest.spyOn(kcet as any, 'hasRawData').mockReturnValue(false);
      expect(kcet.examCode).toBe('KCET');
      expect(kcet.isReadyForEligibility()).toBe(false);
      hasRawDataSpy.mockRestore();
    });
  });
});
