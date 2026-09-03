'use client';

import React from 'react';
import Link from 'next/link';
import type { CollegeResultCard } from '../../../lib/search-api';

function formatLakh(amount: number | null): string {
  if (amount == null) return 'N/A';
  return `₹${(amount / 100000).toFixed(2)} L`;
}

interface SearchCollegeCardProps {
  card: CollegeResultCard;
  isComparing: boolean;
  onToggleCompare: (id: string) => void;
  compareDisabled: boolean;
}

/**
 * Purpose-built for Smart Search's flatter result shape (CollegeResultCard) —
 * the College Explorer's CollegeCard expects the full nested College model,
 * which the search response deliberately doesn't return (see
 * search.service.ts's toCollegeResultCard). Styled with the same
 * colleges-card and card-editorial classes for visual consistency.
 */
export function SearchCollegeCard({ card, isComparing, onToggleCompare, compareDisabled }: SearchCollegeCardProps) {
  return (
    <div className="card-editorial colleges-card smart-search-result-card">
      <div className="colleges-card-banner">
        {card.bannerImage && <img src={card.bannerImage} alt="" loading="lazy" className="colleges-card-banner-img" />}
        <div className="colleges-card-banner-overlay" />
        {card.logo && <img src={card.logo} alt={`${card.name} logo`} loading="lazy" className="colleges-card-logo" />}

        <div className="colleges-card-badges-top">
          {card.nirfRank != null && <span className="colleges-badge colleges-badge-dark">NIRF #{card.nirfRank}</span>}
          {card.naac && <span className="colleges-badge colleges-badge-accent">NAAC {card.naac}</span>}
        </div>

        <span className="smart-search-ai-score" title="AI Recommendation Score — how well this college matches your query and profile">
          🤖 {card.aiScore}
        </span>
      </div>

      <div className="colleges-card-body">
        <div className="colleges-card-title-row">
          <h3 className="font-serif colleges-card-title">{card.name}</h3>
          <span className="colleges-badge colleges-badge-outline">{card.collegeType}</span>
        </div>

        <span className="colleges-card-location">📍 {card.city}, {card.state}</span>

        <div className="colleges-card-chips">
          {card.course && <span className="colleges-badge-editorial-sm">{card.course}</span>}
          {card.hostelAvailable && <span className="colleges-badge-editorial-sm">Hostel Available</span>}
          {card.admissionProbability && (
            <span className="colleges-badge-editorial-sm smart-search-probability">
              {card.admissionProbability.band} · {card.admissionProbability.percent}%
            </span>
          )}
        </div>

        <div className="colleges-card-stats">
          <div>
            <span className="colleges-card-stat-label">Highest Package</span>
            <strong className="colleges-card-stat-value">{card.highestPackage != null ? `₹${card.highestPackage} LPA` : 'N/A'}</strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Avg Package</span>
            <strong className="colleges-card-stat-value">{card.averagePackage != null ? `₹${card.averagePackage} LPA` : 'N/A'}</strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Annual Fee</span>
            <strong className="colleges-card-stat-value colleges-card-stat-accent">{formatLakh(card.totalAnnualFee)}</strong>
          </div>
        </div>

        {card.financialSummary && (
          <div className="smart-search-financial-hint">
            Est. program cost ₹{card.financialSummary.totalProgramCost.toLocaleString('en-IN')} · net burden ₹{card.financialSummary.netFinancialBurden.toLocaleString('en-IN')}
          </div>
        )}

        <div className="colleges-card-actions smart-search-card-actions">
          <Link href={`/colleges/${card.slug}`} className="btn-editorial-primary colleges-card-cta">View Details</Link>
          <Link href={`/financial-planner?collegeId=${card.id}`} className="btn-editorial-secondary">Financial Analysis</Link>
          <label className="colleges-card-compare">
            <input
              type="checkbox"
              checked={isComparing}
              disabled={compareDisabled && !isComparing}
              onChange={() => onToggleCompare(card.id)}
              aria-label={`Add ${card.name} to comparison`}
            />
            Compare
          </label>
        </div>
      </div>
    </div>
  );
}
