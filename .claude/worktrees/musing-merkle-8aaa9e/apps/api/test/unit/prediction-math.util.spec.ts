import {
  computeTrendingClosingRank, probabilityPercentFromRatio, bandFromPercent, confidenceFromDataPoints,
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
      // (5000*3 + 5500*2 + 6000*1) / 6 = (15000+11000+6000)/6 = 32000/6 = 5333.33 -> 5333
      expect(computeTrendingClosingRank(data)).toBe(5333);
    });

    it('is insensitive to input order (sorts internally by year)', () => {
      const ascending = [{ year: 2022, closingRank: 6000 }, { year: 2023, closingRank: 5500 }, { year: 2024, closingRank: 5000 }];
      const shuffled = [{ year: 2024, closingRank: 5000 }, { year: 2022, closingRank: 6000 }, { year: 2023, closingRank: 5500 }];
      expect(computeTrendingClosingRank(shuffled)).toBe(computeTrendingClosingRank(ascending));
    });
  });

  describe('probabilityPercentFromRatio + bandFromPercent — continuity and monotonicity', () => {
    it('is monotonically non-increasing as ratio increases (better rank -> lower or equal ratio -> higher or equal percent)', () => {
      const ratios = [0.1, 0.3, 0.55, 0.6, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 2.0];
      const percents = ratios.map(probabilityPercentFromRatio);
      for (let i = 1; i < percents.length; i++) {
        expect(percents[i]).toBeLessThanOrEqual(percents[i - 1]);
      }
    });

    it('stays within [1, 99]', () => {
      for (const ratio of [0, 0.01, 0.55, 1.0, 1.25, 5, 100]) {
        const p = probabilityPercentFromRatio(ratio);
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(99);
      }
    });

    it('a very favorable ratio bands as Very High', () => {
      expect(bandFromPercent(probabilityPercentFromRatio(0.3))).toBe('Very High');
    });

    it('a ratio right at 1.0 (rank == trending cutoff) bands as Medium', () => {
      expect(bandFromPercent(probabilityPercentFromRatio(1.0))).toBe('Medium');
    });

    it('a very unfavorable ratio bands as Very Low', () => {
      expect(bandFromPercent(probabilityPercentFromRatio(3.0))).toBe('Very Low');
    });

    it('band thresholds are consistent with percent (no disagreement at boundaries)', () => {
      expect(bandFromPercent(90)).toBe('Very High');
      expect(bandFromPercent(89)).toBe('High');
      expect(bandFromPercent(70)).toBe('High');
      expect(bandFromPercent(69)).toBe('Medium');
      expect(bandFromPercent(40)).toBe('Medium');
      expect(bandFromPercent(39)).toBe('Low');
      expect(bandFromPercent(10)).toBe('Low');
      expect(bandFromPercent(9)).toBe('Very Low');
    });
  });

  describe('confidenceFromDataPoints', () => {
    it('classifies by number of historical cutoff data points', () => {
      expect(confidenceFromDataPoints(0)).toBe('low');
      expect(confidenceFromDataPoints(1)).toBe('low');
      expect(confidenceFromDataPoints(2)).toBe('medium');
      expect(confidenceFromDataPoints(3)).toBe('high');
      expect(confidenceFromDataPoints(10)).toBe('high');
    });
  });
});
