import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollegeCard } from '../CollegeCard';
import type { College } from '../../../lib/colleges-api';

function buildCollege(overrides: Partial<College> = {}): College {
  return {
    _id: 'c1', id: 'c1', slug: 'rvce', name: 'RVCE',
    aliasNames: [], state: 'Karnataka', city: 'Bengaluru', district: 'Bengaluru Urban',
    collegeType: 'Government', establishedYear: 1963, aicteApproved: true,
    rating: 4.8, reviewsCount: 124, campusSizeAcres: 52, studentCount: 6500, facultyCount: 420,
    bannerImage: '/banner.jpg', logo: '/logo.png', description: 'A top engineering college.',
    highlights: [], accreditation: { nirfRank: 12, nbaCourses: [] },
    contact: {}, feeBreakdown: { tuitionFee: 150000, hostelFee: 40000, messFee: 20000, otherCharges: 5000, totalAnnualFee: 215000 },
    hostelInfo: { boysHostel: true, girlsHostel: true, capacity: 2000, roomTypes: [], messDetails: '', amenities: [], images: [] },
    gallery: [],
    courses: [{ courseId: 'CSE', name: 'Computer Science', degreeType: 'B.E.', durationYears: 4, intake: 180, examsAccepted: ['KCET'], feePerYear: 200000, eligibility: '', cutoffRankSummary: 800, discipline: 'Engineering' }],
    placementSummary: [{ year: 2025, highestPackage: 52, averagePackage: 12.8, medianPackage: 10.5, placementPercentage: 96.4, topRecruiters: [] }],
    admissionProcess: [], reviewsList: [], isVerified: true,
    ...overrides,
  };
}

describe('CollegeCard', () => {
  it('renders the college name, fee, and admission-difficulty badge', () => {
    render(
      <CollegeCard
        college={buildCollege()}
        isFavorite={false} onToggleFavorite={() => {}}
        isComparing={false} onToggleCompare={() => {}} compareDisabled={false}
      />,
    );
    expect(screen.getByText('RVCE')).toBeInTheDocument();
    expect(screen.getByText('₹2.15 L')).toBeInTheDocument();
    expect(screen.getByText('Highly Competitive')).toBeInTheDocument();
  });

  it('calls onToggleFavorite with the college id when the favorite button is clicked', async () => {
    const onToggleFavorite = vi.fn();
    render(
      <CollegeCard
        college={buildCollege()}
        isFavorite={false} onToggleFavorite={onToggleFavorite}
        isComparing={false} onToggleCompare={() => {}} compareDisabled={false}
      />,
    );

    await userEvent.setup().click(screen.getByRole('button', { name: /add rvce to favorites/i }));
    expect(onToggleFavorite).toHaveBeenCalledWith('c1');
  });

  it('reflects isFavorite in the pressed state and label', () => {
    render(
      <CollegeCard
        college={buildCollege()}
        isFavorite={true} onToggleFavorite={() => {}}
        isComparing={false} onToggleCompare={() => {}} compareDisabled={false}
      />,
    );
    expect(screen.getByRole('button', { name: /remove rvce from favorites/i })).toHaveAttribute('aria-pressed', 'true');
  });
});
