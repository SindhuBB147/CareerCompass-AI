'use client';

import React from 'react';
import Link from 'next/link';
import type { College } from '../../lib/colleges-api';
import { collegeImageSrc, onCollegeImageError } from '../../lib/college-image';

// Deterministic, data-driven admission-difficulty label from each college's
// best (lowest) course cutoff rank on file — NOT a personalized AI
// prediction. A true admission-probability score requires the student's own
// rank (see /predictions), which this generic directory card doesn't have.
function admissionLevel(college: College): { label: string; tone: 'high' | 'medium' | 'low' } | null {
  const ranks = college.courses.map((c) => c.cutoffRankSummary).filter((r): r is number => typeof r === 'number');
  if (ranks.length === 0) return null;
  const best = Math.min(...ranks);
  if (best <= 1000) return { label: 'Highly Competitive', tone: 'high' };
  if (best <= 10000) return { label: 'Moderately Competitive', tone: 'medium' };
  return { label: 'Open Admission', tone: 'low' };
}

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} L`;
}

interface CollegeCardProps {
  college: College;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  isComparing: boolean;
  onToggleCompare: (id: string) => void;
  compareDisabled: boolean;
}

export function CollegeCard({ college, isFavorite, onToggleFavorite, isComparing, onToggleCompare, compareDisabled }: CollegeCardProps) {
  const id = college.id || college._id;
  const latestPlacement = college.placementSummary?.[college.placementSummary.length - 1];
  const hasHostel = college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel;
  const level = admissionLevel(college);
  const href = `/colleges/${college.collegeId || college.slug}`;

  return (
    <div className="card-editorial colleges-card colleges-card--clickable" style={{ position: 'relative' }}>

      {/*
        Full-card overlay link (Airbnb / LinkedIn pattern).
        - Absolutely stretched to fill the entire card (z-index: 1).
        - Interactive children (favorite button, compare label, View Details
          link) are raised above it with position:relative + z-index:2.
        - aria-label gives screen readers a clean description without
          duplicating all the visible card text.
        - tabIndex={0} keeps the card itself keyboard-focusable; Enter/Space
          activate it via the native anchor behaviour.
      */}
      <Link
        href={href}
        className="colleges-card-overlay-link"
        aria-label={`View details for ${college.name}`}
        tabIndex={0}
      />

      <div className="colleges-card-banner">
        <img
          src={collegeImageSrc(college.bannerImage)}
          onError={onCollegeImageError}
          alt=""
          loading="lazy"
          decoding="async"
          className="colleges-card-banner-img"
        />
        <div className="colleges-card-banner-overlay" />

        {college.logo && (
          <img src={college.logo} alt={`${college.name} logo`} loading="lazy" className="colleges-card-logo" />
        )}

        <div className="colleges-card-badges-top">
          {college.accreditation?.nirfRank && (
            <span className="colleges-badge colleges-badge-dark">NIRF #{college.accreditation.nirfRank}</span>
          )}
          {college.accreditation?.naac && (
            <span className="colleges-badge colleges-badge-accent">NAAC {college.accreditation.naac}</span>
          )}
        </div>

        {/* Favorite button — absolutely positioned by CSS (.colleges-card-favorite).
            No inline position style here — overriding position:relative would break
            the CSS position:absolute that pins it to the banner corner.
            z-index is handled by .colleges-card-banner's stacking context (see CSS). */}
        <button
          type="button"
          className="colleges-card-favorite"
          aria-pressed={isFavorite}
          aria-label={isFavorite ? `Remove ${college.name} from favorites` : `Add ${college.name} to favorites`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(id); }}
        >
          {isFavorite ? '♥' : '♡'}
        </button>
      </div>

      <div className="colleges-card-body">
        <div className="colleges-card-title-row">
          <h3 className="font-serif colleges-card-title">{college.name}</h3>
          <span className="colleges-badge colleges-badge-outline">{college.collegeType}</span>
        </div>

        <span className="colleges-card-location">
          📍 {college.city}{college.district ? `, ${college.district}` : ''}, {college.state}
          {college.establishedYear ? ` • Estd ${college.establishedYear}` : ''}
        </span>

        <div className="colleges-card-chips">
          {college.aicteApproved && <span className="colleges-badge-editorial-sm">AICTE Approved</span>}
          {hasHostel && <span className="colleges-badge-editorial-sm">Hostel Available</span>}
          <span className="colleges-badge-editorial-sm">{college.courses?.length ?? 0} Courses</span>
          {level && (
            <span className={`colleges-badge-editorial-sm colleges-admission-${level.tone}`} title="Based on the lowest published cutoff rank across this college's courses">
              {level.label}
            </span>
          )}
        </div>

        <div className="colleges-card-stats">
          <div>
            <span className="colleges-card-stat-label">Highest Package</span>
            <strong className="colleges-card-stat-value">
              {latestPlacement?.highestPackage ? `₹${latestPlacement.highestPackage} LPA` : 'N/A'}
            </strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Avg Package</span>
            <strong className="colleges-card-stat-value">
              {latestPlacement?.averagePackage ? `₹${latestPlacement.averagePackage} LPA` : 'N/A'}
            </strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Annual Fee</span>
            <strong className="colleges-card-stat-value colleges-card-stat-accent">
              {college.feeBreakdown?.totalAnnualFee ? formatLakh(college.feeBreakdown.totalAnnualFee) : 'Not publicly disclosed'}
            </strong>
          </div>
        </div>

        {/* Actions row — raised above overlay link */}
        <div className="colleges-card-actions" style={{ position: 'relative', zIndex: 2 }}>
          <Link href={href} className="btn-editorial-primary colleges-card-cta">
            View Details
          </Link>
          <label className="colleges-card-compare">
            <input
              type="checkbox"
              checked={isComparing}
              disabled={compareDisabled && !isComparing}
              onChange={() => onToggleCompare(id)}
              aria-label={`Add ${college.name} to comparison`}
            />
            Compare
          </label>
        </div>
      </div>
    </div>
  );
}
