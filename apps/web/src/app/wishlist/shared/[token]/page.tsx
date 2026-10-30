'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { wishlistApi } from '../../../../lib/wishlist-api';
import type { College } from '../../../../lib/colleges-api';

const KIND_LABELS: Record<string, string> = {
  wishlist: 'Shared Wishlist', list: 'Shared College List', comparison: 'Shared Comparison',
};

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} L`;
}

export default function SharedWishlistPage() {
  const params = useParams();
  const token = params?.token as string;

  const [colleges, setColleges] = useState<College[]>([]);
  const [kind, setKind] = useState<string>('wishlist');
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    wishlistApi.getShared(token)
      .then((res) => { setColleges(res.colleges); setKind(res.kind); setCreatedAt(res.createdAt); })
      .catch(() => setNotFound(true))
      .finally(() => setIsLoading(false));
  }, [token]);

  return (
    <div className="section-padding container-editorial colleges-page">
      <div className="colleges-compare-header">
        <span className="colleges-hero-eyebrow">CareerCompass AI</span>
        <h1 className="text-section-title font-serif">{KIND_LABELS[kind] ?? 'Shared Wishlist'}</h1>
        {createdAt && <p className="text-body">Shared on {new Date(createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
      </div>

      {isLoading ? (
        <div className="card-editorial" style={{ padding: '64px', textAlign: 'center' }}>Loading…</div>
      ) : notFound ? (
        <div className="card-editorial colleges-empty-state">
          <div className="colleges-empty-icon">🔗</div>
          <h3 className="font-serif colleges-empty-title">This Link Is Invalid or Has Expired</h3>
          <p className="text-body colleges-empty-desc">Shared wishlist links expire after 30 days.</p>
          <Link href="/colleges" className="btn-editorial-primary">Explore Colleges</Link>
        </div>
      ) : (
        <div className="colleges-grid-cards">
          {colleges.map((c) => {
            const latestPlacement = c.placementSummary?.[c.placementSummary.length - 1];
            return (
              <div key={c.id || c._id} className="card-editorial colleges-card">
                <div className="colleges-card-banner">
                  <img src={c.bannerImage} alt="" loading="lazy" className="colleges-card-banner-img" />
                  <div className="colleges-card-banner-overlay" />
                  <img src={c.logo} alt="" loading="lazy" className="colleges-card-logo" />
                  {c.accreditation?.nirfRank && (
                    <div className="colleges-card-badges-top">
                      <span className="colleges-badge colleges-badge-dark">NIRF #{c.accreditation.nirfRank}</span>
                    </div>
                  )}
                </div>
                <div className="colleges-card-body">
                  <div className="colleges-card-title-row">
                    <h3 className="font-serif colleges-card-title">{c.name}</h3>
                    <span className="colleges-badge colleges-badge-outline">{c.collegeType}</span>
                  </div>
                  <span className="colleges-card-location">📍 {c.city}, {c.state}</span>
                  <div className="colleges-card-stats">
                    <div>
                      <span className="colleges-card-stat-label">Highest Package</span>
                      <strong className="colleges-card-stat-value">{latestPlacement ? `₹${latestPlacement.highestPackage} LPA` : 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="colleges-card-stat-label">Annual Fee</span>
                      <strong className="colleges-card-stat-value colleges-card-stat-accent">{formatLakh(c.feeBreakdown?.totalAnnualFee ?? 0)}</strong>
                    </div>
                  </div>
                  <Link href={`/colleges/${c.slug}`} className="btn-editorial-primary colleges-card-cta">View Details</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="card-editorial wishlist-share-cta">
        <p className="text-body">Want to build your own college wishlist with AI-powered insights?</p>
        <Link href="/register" className="btn-editorial-primary">Get Started with CareerCompass AI</Link>
      </div>
    </div>
  );
}
