import { describe, expect, it } from 'vitest';
import { formatCurrency, calculateEmi, rankBucket } from '@career-compass/utils';

// Exercises @career-compass/utils exactly as apps/web consumes it — a real
// workspace import, not a relative reach into packages/ — which is the part
// that used to be broken (the package had no package.json at all).
describe('@career-compass/utils', () => {
  describe('formatCurrency', () => {
    it('abbreviates crores', () => {
      expect(formatCurrency(15000000)).toBe('₹1.50 Cr');
    });
    it('abbreviates lakhs', () => {
      expect(formatCurrency(250000)).toBe('₹2.50 Lakh');
    });
    it('uses Indian grouping below one lakh', () => {
      expect(formatCurrency(45000)).toBe('₹45,000');
    });
    it('returns ₹0 for NaN', () => {
      expect(formatCurrency(NaN)).toBe('₹0');
    });
  });

  describe('calculateEmi', () => {
    it('computes a positive EMI for a standard loan', () => {
      const result = calculateEmi(1000000, 10, 5);
      expect(result.monthlyEmi).toBeGreaterThan(0);
      expect(result.totalPayment).toBeGreaterThan(1000000);
    });

    it('handles zero interest as a flat split', () => {
      const result = calculateEmi(120000, 0, 1);
      expect(result).toEqual({ monthlyEmi: 10000, totalInterest: 0, totalPayment: 120000 });
    });

    it('returns zeros for an invalid principal', () => {
      expect(calculateEmi(0, 10, 5)).toEqual({ monthlyEmi: 0, totalInterest: 0, totalPayment: 0 });
    });
  });

  describe('rankBucket', () => {
    it('buckets a top rank', () => {
      expect(rankBucket(500)).toBe('1 - 1,000');
    });
    it('buckets a rank beyond the largest bucket', () => {
      expect(rankBucket(60000)).toBe('50,000+');
    });
  });
});
