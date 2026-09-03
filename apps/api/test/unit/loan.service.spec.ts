import { LoanService } from '../../src/modules/financial-planning/services/loan.service';

describe('LoanService', () => {
  let service: LoanService;
  beforeEach(() => { service = new LoanService(); });

  describe('calculateLoan', () => {
    it('delegates to amortize() and returns a full-tenure result', () => {
      const result = service.calculateLoan({ loanAmount: 500000, interestRate: 9, tenureYears: 5 } as any);
      expect(result.yearlySchedule).toHaveLength(5);
      expect(result.monthlyEmi).toBeGreaterThan(0);
    });
  });

  describe('compareLoanOffers', () => {
    it('sorts 2 offers ascending by totalCostOfLoan and reports the cheapest label', () => {
      const result = service.compareLoanOffers({
        offers: [
          { label: 'Bank A (high rate)', loanAmount: 500000, interestRate: 12, tenureYears: 8 },
          { label: 'Bank B (low rate)', loanAmount: 500000, interestRate: 8, tenureYears: 8 },
        ],
      } as any);
      expect(result.offers).toHaveLength(2);
      expect(result.offers[0].totalCostOfLoan).toBeLessThanOrEqual(result.offers[1].totalCostOfLoan);
      expect(result.cheapestLabel).toBe('Bank B (low rate)');
      expect(result.cheapestLabel).toBe(result.offers[0].label);
    });

    it('sorts 3 offers ascending by totalCostOfLoan', () => {
      const result = service.compareLoanOffers({
        offers: [
          { label: 'C', loanAmount: 500000, interestRate: 10, tenureYears: 8 },
          { label: 'A', loanAmount: 500000, interestRate: 7, tenureYears: 8 },
          { label: 'B', loanAmount: 500000, interestRate: 8.5, tenureYears: 8 },
        ],
      } as any);
      expect(result.offers).toHaveLength(3);
      for (let i = 1; i < result.offers.length; i++) {
        expect(result.offers[i].totalCostOfLoan).toBeGreaterThanOrEqual(result.offers[i - 1].totalCostOfLoan);
      }
      expect(result.cheapestLabel).toBe('A');
    });
  });
});
