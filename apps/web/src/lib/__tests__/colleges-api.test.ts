import { describe, expect, it } from 'vitest';
import { collegesApi } from '../colleges-api';

describe('collegesApi.getCutoffPdfUrl', () => {
  it('uses the same proxied API route as the shared client', () => {
    expect(collegesApi.getCutoffPdfUrl('college-1', {
      examCode: 'COMEDK', year: 2024, round: 2, category: 'GM',
    })).toBe('/api/v1/colleges/college-1/cutoffs/export/pdf?examCode=COMEDK&year=2024&round=2&category=GM');
  });
});
