import { resolveCityTier, estimateLivingCost, estimateAnnualLivingCost } from '../../src/modules/financial-planning/utils/living-cost.util';

describe('living-cost.util', () => {
  describe('resolveCityTier', () => {
    it('resolves known Bengaluru spelling variants to tier1, case-insensitively', () => {
      expect(resolveCityTier('Bengaluru')).toBe('tier1');
      expect(resolveCityTier('bangalore')).toBe('tier1');
      expect(resolveCityTier('  BENGALURU  ')).toBe('tier1');
    });

    it('resolves Mysuru/Mangaluru variants to tier2', () => {
      expect(resolveCityTier('Mysuru')).toBe('tier2');
      expect(resolveCityTier('Mysore')).toBe('tier2');
      expect(resolveCityTier('Mangalore')).toBe('tier2');
    });

    it('falls back to tier2 (DEFAULT_CITY_TIER) for an unknown city', () => {
      expect(resolveCityTier('Some Unlisted Town')).toBe('tier2');
    });

    it('falls back to tier2 when city is undefined or null', () => {
      expect(resolveCityTier(undefined)).toBe('tier2');
      expect(resolveCityTier(null)).toBe('tier2');
    });
  });

  describe('estimateLivingCost', () => {
    it('selects the hostel rent field for accommodationType hostel', () => {
      const result = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'hostel' });
      expect(result.rentOrHostelMonthly).toBeGreaterThan(0);
      expect(result.accommodationType).toBe('hostel');
    });

    it('zeroes rent/electricity/internet/laundry for day_scholar', () => {
      const result = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'day_scholar' });
      expect(result.rentOrHostelMonthly).toBe(0);
      expect(result.electricityMonthly).toBe(0);
      expect(result.internetMonthly).toBe(0);
      expect(result.laundryMonthly).toBe(0);
      // Food/personal/medical still apply even for a day scholar.
      expect(result.foodMonthly).toBeGreaterThan(0);
    });

    it('applies the two_wheeler transport multiplier above public, and zeroes for none', () => {
      const publicResult = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'pg', transportPreference: 'public' });
      const twoWheelerResult = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'pg', transportPreference: 'two_wheeler' });
      const noneResult = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'pg', transportPreference: 'none' });

      expect(twoWheelerResult.transportMonthly).toBeGreaterThan(publicResult.transportMonthly);
      expect(noneResult.transportMonthly).toBe(0);
    });

    it('totalMonthly/totalAnnual are internally consistent sums', () => {
      const result = estimateLivingCost({ city: 'Mysuru', accommodationType: 'apartment_shared', transportPreference: 'public' });
      const expectedMonthly = result.rentOrHostelMonthly + result.electricityMonthly + result.internetMonthly
        + result.laundryMonthly + result.foodMonthly + result.personalMonthly + result.transportMonthly + result.medicalMiscMonthly;
      expect(result.totalMonthly).toBe(expectedMonthly);
      expect(result.totalAnnual).toBe(result.totalMonthly * 12);
    });

    it('a higher-tier city (tier1) costs at least as much as a lower-tier city (tier3) for the same accommodation type', () => {
      const tier1 = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'hostel' });
      const tier3 = estimateLivingCost({ city: 'Kalaburagi', accommodationType: 'hostel' });
      expect(tier1.totalMonthly).toBeGreaterThan(tier3.totalMonthly);
    });
  });

  describe('estimateAnnualLivingCost', () => {
    it('matches estimateLivingCost().totalAnnual for the hosteller default', () => {
      const annual = estimateAnnualLivingCost('Bengaluru', true);
      const full = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'hostel', transportPreference: 'public' });
      expect(annual).toBe(full.totalAnnual);
    });

    it('matches estimateLivingCost().totalAnnual for the non-hosteller default', () => {
      const annual = estimateAnnualLivingCost('Bengaluru', false);
      const full = estimateLivingCost({ city: 'Bengaluru', accommodationType: 'day_scholar', transportPreference: 'none' });
      expect(annual).toBe(full.totalAnnual);
    });
  });
});
