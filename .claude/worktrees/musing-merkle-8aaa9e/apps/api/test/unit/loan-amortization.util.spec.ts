import { amortize } from '../../src/modules/financial-planning/utils/loan-amortization.util';

describe('loan-amortization.util', () => {
  describe('amortize — EMI formula regression (no drift from the old calculateLoan)', () => {
    it('matches the standard reducing-balance EMI for a known input with no moratorium', () => {
      // P=1,000,000, rate=9%, tenure=10y -> monthly rate 0.0075, n=120
      // emi = P*r*(1+r)^n / ((1+r)^n - 1) ≈ 12667.58 -> rounds to 12668
      const result = amortize({ loanAmount: 1000000, interestRate: 9, tenureYears: 10 });
      expect(result.monthlyEmi).toBe(12668);
      expect(result.moratoriumInterestAccrued).toBe(0);
    });

    it('accrues simple interest during moratorium and folds it into the EMI principal', () => {
      const noMoratorium = amortize({ loanAmount: 500000, interestRate: 10, tenureYears: 8 });
      const withMoratorium = amortize({ loanAmount: 500000, interestRate: 10, tenureYears: 8, moratoriumMonths: 24 });
      expect(withMoratorium.moratoriumInterestAccrued).toBeGreaterThan(0);
      expect(withMoratorium.monthlyEmi).toBeGreaterThan(noMoratorium.monthlyEmi);
    });
  });

  describe('amortize — full-tenure schedule (extends the old first-12-months-only behavior)', () => {
    it('yearlySchedule has one entry per tenure year, not capped at 1', () => {
      const result = amortize({ loanAmount: 800000, interestRate: 8.5, tenureYears: 7 });
      expect(result.yearlySchedule).toHaveLength(7);
    });

    it('sum of yearly principal+interest equals totalPayment (within rounding)', () => {
      const result = amortize({ loanAmount: 600000, interestRate: 9.5, tenureYears: 5 });
      const summedPayment = result.yearlySchedule.reduce((s, y) => s + y.totalPrincipalPaid + y.totalInterestPaid, 0);
      expect(Math.abs(summedPayment - result.totalPayment)).toBeLessThanOrEqual(result.yearlySchedule.length);
    });

    it('closing balance reaches (near) zero in the final year', () => {
      const result = amortize({ loanAmount: 300000, interestRate: 11, tenureYears: 3 });
      const last = result.yearlySchedule[result.yearlySchedule.length - 1];
      expect(last.closingBalance).toBeLessThanOrEqual(1);
    });

    it('omits monthlySchedule by default (undefined, not an empty array) to keep payloads small', () => {
      const result = amortize({ loanAmount: 400000, interestRate: 9, tenureYears: 4 });
      expect(result.monthlySchedule).toBeUndefined();
    });

    it('populates monthlySchedule with tenureYears*12 entries when requested', () => {
      const result = amortize({ loanAmount: 400000, interestRate: 9, tenureYears: 4, includeMonthlySchedule: true });
      expect(result.monthlySchedule).toHaveLength(48);
    });
  });

  describe('amortize — processing fee', () => {
    it('respects the processing fee cap', () => {
      const result = amortize({ loanAmount: 5000000, interestRate: 9, tenureYears: 10, processingFeePercent: 1, processingFeeCap: 25000 });
      expect(result.processingFeeAmount).toBe(25000);
    });

    it('computes below-cap processing fee as a straight percentage', () => {
      const result = amortize({ loanAmount: 500000, interestRate: 9, tenureYears: 10, processingFeePercent: 1, processingFeeCap: 25000 });
      expect(result.processingFeeAmount).toBe(5000);
    });

    it('totalCostOfLoan = totalPayment + processingFeeAmount', () => {
      const result = amortize({ loanAmount: 500000, interestRate: 9, tenureYears: 10 });
      expect(result.totalCostOfLoan).toBe(result.totalPayment + result.processingFeeAmount);
    });
  });
});
