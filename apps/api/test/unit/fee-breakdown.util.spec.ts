import { decomposeFeeIntoLineItems } from '../../src/modules/financial-planning/utils/fee-breakdown.util';

const BASE_INPUT = {
  academicFeePerYear: 220000,
  hostelFeePerYear: 60000,
  messFeePerYear: 36000,
  otherChargesPerYear: 5000,
  durationYears: 4,
  isHosteller: true,
  livingCostNonHostelPerYear: 84000,
};

describe('fee-breakdown.util — decomposeFeeIntoLineItems', () => {
  it('splits the academic fee into sub-items that sum back to the original total', () => {
    const result = decomposeFeeIntoLineItems(BASE_INPUT);
    const year1Items = result.yearly[0].lineItems;
    const academicSplitSum = ['Tuition Fee', 'Development Fee', 'Laboratory Fee', 'Library Fee', 'Examination Fee']
      .reduce((sum, label) => sum + (year1Items.find(li => li.label === label)?.amount ?? 0), 0);
    expect(academicSplitSum).toBe(BASE_INPUT.academicFeePerYear);
  });

  it('tags the academic-fee split lines as estimated and the DB-sourced lines as db', () => {
    const result = decomposeFeeIntoLineItems(BASE_INPUT);
    const items = result.yearly[0].lineItems;
    expect(items.find(li => li.label === 'Tuition Fee')?.source).toBe('estimated');
    expect(items.find(li => li.label === 'Hostel Fee')?.source).toBe('db');
    expect(items.find(li => li.label === 'Mess Charges')?.source).toBe('db');
    expect(items.find(li => li.label === 'University / Other Charges')?.source).toBe('db');
  });

  describe('hosteller vs. non-hosteller branch', () => {
    it('includes Hostel Fee, Mess Charges and Internet for a hosteller', () => {
      const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, isHosteller: true });
      const labels = result.yearly[0].lineItems.map(li => li.label);
      expect(labels).toContain('Hostel Fee');
      expect(labels).toContain('Mess Charges');
      expect(labels).toContain('Internet');
      expect(labels).not.toContain('Living Expenses (Day Scholar)');
    });

    it('includes only the estimated living-expense line for a non-hosteller', () => {
      const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, isHosteller: false });
      const items = result.yearly[0].lineItems;
      const labels = items.map(li => li.label);
      expect(labels).toContain('Living Expenses (Day Scholar)');
      expect(labels).not.toContain('Hostel Fee');
      expect(labels).not.toContain('Mess Charges');
      expect(items.find(li => li.label === 'Living Expenses (Day Scholar)')?.amount).toBe(BASE_INPUT.livingCostNonHostelPerYear);
    });
  });

  it('Year-1-only one-time items appear only in year 1, not later years', () => {
    const result = decomposeFeeIntoLineItems(BASE_INPUT);
    expect(result.yearly[0].lineItems.map(li => li.label)).toContain('Admission Fee');
    expect(result.yearly[0].lineItems.map(li => li.label)).toContain('Uniform / Equipment');
    for (const year of result.yearly.slice(1)) {
      expect(year.lineItems.map(li => li.label)).not.toContain('Admission Fee');
      expect(year.lineItems.map(li => li.label)).not.toContain('Uniform / Equipment');
    }
  });

  describe('laptop inclusion flag', () => {
    it('excludes the laptop line item and cost entirely when includeLaptop is falsy', () => {
      const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, includeLaptop: false });
      expect(result.yearly[0].lineItems.map(li => li.label)).not.toContain('Laptop (Recommended)');
      expect(result.totalProgramCostWithLaptop).toBe(result.totalProgramCost);
    });

    it('adds the laptop line to year 1 but still excludes it from totalProgramCost', () => {
      const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, includeLaptop: true });
      expect(result.yearly[0].lineItems.map(li => li.label)).toContain('Laptop (Recommended)');
      expect(result.totalProgramCostWithLaptop).toBeGreaterThan(result.totalProgramCost);
    });
  });

  it('semester halves sum back to (approximately) the yearly total', () => {
    const result = decomposeFeeIntoLineItems(BASE_INPUT);
    for (const year of result.yearly) {
      const sem1 = result.semesterWise.find(s => s.year === year.year && s.semester === 1)!;
      const sem2 = result.semesterWise.find(s => s.year === year.year && s.semester === 2)!;
      // Rounding each recurring half independently can drift by at most
      // ~1 rupee per recurring line item.
      expect(Math.abs((sem1.total + sem2.total) - year.total)).toBeLessThanOrEqual(year.lineItems.length);
    }
  });

  it('scales yearly entries with durationYears (5-year MBBS-like course)', () => {
    const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, durationYears: 5 });
    expect(result.yearly).toHaveLength(5);
    expect(result.semesterWise).toHaveLength(10);
  });

  it('scales yearly entries with durationYears (6-year Pharma-D-like course)', () => {
    const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, durationYears: 6 });
    expect(result.yearly).toHaveLength(6);
  });

  it('years after year 1 have identical recurring totals (flat fee, no escalation model)', () => {
    const result = decomposeFeeIntoLineItems({ ...BASE_INPUT, durationYears: 5 });
    const [, year2, year3, year4, year5] = result.yearly;
    expect(year2.total).toBe(year3.total);
    expect(year3.total).toBe(year4.total);
    expect(year4.total).toBe(year5.total);
  });

  it('totalProgramCost sums all years, excluding the optional laptop', () => {
    const result = decomposeFeeIntoLineItems(BASE_INPUT);
    const summed = result.yearly.reduce((sum, y) => sum + y.total, 0);
    expect(result.totalProgramCost).toBe(summed);
  });
});
