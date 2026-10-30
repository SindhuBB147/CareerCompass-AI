import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportCard, ReportCardDef } from '../ReportCard';

const liveDef: ReportCardDef = { key: 'saved_colleges', icon: '📚', title: 'Saved Colleges Report', description: 'Your wishlist at a glance.', live: true };
const comingSoonDef: ReportCardDef = { ...liveDef, key: 'hypothetical', title: 'Hypothetical Report', live: false };

describe('ReportCard', () => {
  it('shows a Generate action for a live report type (all 8 types are live post-completion)', () => {
    render(<ReportCard def={liveDef} busy={false} onGenerate={() => {}} onPreview={() => {}} />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
  });

  it('shows a Coming Soon badge instead of a Generate action when a card is marked non-live', () => {
    render(<ReportCard def={comingSoonDef} busy={false} onGenerate={() => {}} onPreview={() => {}} />);
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
  });
});
