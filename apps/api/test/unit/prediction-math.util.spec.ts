import {
  computeTrendingClosingRank,
  probabilityPercentFromRatio,
  bandFromPercent,
  confidenceFromDataPoints,
  classifyPortfolio,
  recommendationScoreFromRatio,
  SAFE_RATIO,
  TARGET_RATIO,
  DREAM_RATIO,
} from '../../src/modules/predictions/utils/prediction-math.util';

describe('prediction-math.util', () => {
  describe('computeTrendingClosingRank', () => {
    it('returns 0 for no data', () => {
      expect(computeTrendingClosingRank([])).toBe(0);
    });

    it('returns the single value when only one data point exists', () => {
      expect(computeTrendingClosingRank([{ year: 2024, closingRank: 5000 }])).toBe(5000);
    });

    it('weights the most recent year 3x, second 2x, older 1x', () => {
      const data = [
        { year: 2022, closingRank: 6000 },
        { year: 2023, closingRank: 5500 },
        { year: 2024, closingRank: 5000 },
      ];
      expect(computeTrendingClosingRank(data)).toBe(5333);
    });

    it('is insensitive to input order (sorts internally by year)', () => {
      const ascending = [{ year: 2022, closingRank: 6000 }, { year: 2023, closingRank: 5500 }, { year: 2024, closingRank: 5000 }];
      const shuffled = [{ year: 2024, closingRank: 5000 }, { year: 2022, closingRank: 6000 }, { year: 2023, closingRank: 5500 }];
      expect(computeTrendingClosingRank(shuffled)).toBe(computeTrendingClosingRank(ascending));
    });
  });

  describe('classifyPortfolio — SAFE / TARGET / DREAM rules', () => {
    it('returns INSUFFICIENT_DATA when reference cutoff is invalid or 0', () => {
      expect(classifyPortfolio(5000, 0)).toBe('INSUFFICIENT_DATA');
      expect(classifyPortfolio(0, 5000)).toBe('INSUFFICIENT_DATA');
    });

    it('classifies rank <= 80% of cutoff as SAFE', () => {
      expect(classifyPortfolio(4000, 5000)).toBe('SAFE'); // ratio = 0.80
      expect(classifyPortfolio(3000, 5000)).toBe('SAFE'); // ratio = 0.60
    });

    it('classifies 80% < rank <= 105% of cutoff as TARGET', () => {
      expect(classifyPortfolio(4500, 5000)).toBe('TARGET'); // ratio = 0.90
      expect(classifyPortfolio(5250, 5000)).toBe('TARGET'); // ratio = 1.05
    });

    it('classifies 105% < rank <= 130% of cutoff as DREAM', () => {
      expect(classifyPortfolio(5500, 5000)).toBe('DREAM'); // ratio = 1.10
      expect(classifyPortfolio(6500, 5000)).toBe('DREAM'); // ratio = 1.30
    });

    it('classifies rank > 130% of cutoff as OUTSIDE_HISTORICAL_RANGE', () => {
      expect(classifyPortfolio(7000, 5000)).toBe('OUTSIDE_HISTORICAL_RANGE'); // ratio = 1.40
    });

    it('handles top ranks (<= 500) using absolute rank margin delta', () => {
      expect(classifyPortfolio(100, 300)).toBe('SAFE'); // 300 - 100 = 200 >= 100
      expect(classifyPortfolio(250, 300)).toBe('TARGET'); // 300 - 250 = 50 >= -50
      expect(classifyPortfolio(400, 300)).toBe('DREAM'); // 300 - 400 = -100 >= -150
      expect(classifyPortfolio(500, 300)).toBe('OUTSIDE_HISTORICAL_RANGE'); // 300 - 500 = -200 < -150
    });
  });

  describe('recommendationScoreFromRatio', () => {
    it('is monotonically non-increasing as ratio increases', () => {
      const ratios = [0.1, 0.3, 0.55, 0.8, 1.05, 1.30, 2.0];
      const scores = ratios.map(recommendationScoreFromRatio);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });

    it('stays strictly within [1, 99]', () => {
      for (const ratio of [0, 0.01, 0.55, 1.0, 1.3, 5, 100]) {
        const s = recommendationScoreFromRatio(ratio);
        expect(s).toBeGreaterThanOrEqual(1);
        expect(s).toBeLessThanOrEqual(99);
      }
    });
  });
});
