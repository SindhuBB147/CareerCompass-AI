import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { FiltersPanel, type PredictionSortOption } from './FiltersPanel';
import type { PredictorFilters } from '../types';

vi.mock('../../../../lib/colleges-api', () => ({
  collegesApi: { getFacets: vi.fn().mockResolvedValue({ cities: ['Bagalkote'], districts: ['Bagalkote'] }) },
}));

function Harness({ examCode = 'COMEDK' as const }: { examCode?: 'KCET' | 'COMEDK' }) {
  const [filters, setFilters] = React.useState<PredictorFilters>({});
  const [sortBy, setSortBy] = React.useState<PredictionSortOption>('nirf');
  return <FiltersPanel examCode={examCode} filters={filters} onChange={setFilters} sortBy={sortBy} onSortByChange={setSortBy} />;
}

describe('Prediction FiltersPanel', () => {
  it('keeps filters controlled, counts active filters and applies search, course, type, location and hostel', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByRole('textbox', { name: /search colleges or courses/i }), 'BMS');
    await user.selectOptions(screen.getByRole('combobox', { name: /course filter/i }), 'Computer Science & IT');
    await user.selectOptions(screen.getByRole('combobox', { name: /college type filter/i }), 'Autonomous');
    await user.type(screen.getByLabelText('City Filter'), 'Bagalkot');
    await user.click(screen.getByLabelText('Hostel'));
    expect(screen.getByText('Filter (5)')).toBeInTheDocument();
  });

  it('expands More filters, updates advanced filters and Reset restores defaults', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const more = screen.getByRole('button', { name: /more/i });
    await user.click(more);
    expect(screen.getByLabelText('District')).toBeVisible();
    await user.type(screen.getByLabelText('District'), 'Bagalkote');
    await user.selectOptions(screen.getByRole('combobox', { name: /sort order/i }), 'fee_asc');
    await user.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.queryByLabelText('District')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /sort order/i })).toHaveValue('nirf');
    expect(screen.getByText('Filter')).toBeInTheDocument();
  });

  it('uses exam-specific course options and displays COMEDK historical sorting', () => {
    render(<Harness />);
    expect(screen.getByRole('option', { name: 'Computer Science & IT' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'B.Sc Nursing' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Historical rank fit (Default)' })).toBeInTheDocument();
  });
});
