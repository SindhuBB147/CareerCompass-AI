'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { BookmarkStatus, SavedCollegeView } from '../../lib/wishlist-api';
import { collegeImageSrc, onCollegeImageError } from '../../lib/college-image';

const STATUS_OPTIONS: { value: BookmarkStatus; label: string }[] = [
  { value: 'dream', label: 'Dream' },
  { value: 'target', label: 'Target' },
  { value: 'safe', label: 'Safe' },
  { value: 'backup', label: 'Backup' },
  { value: 'interested', label: 'Interested' },
  { value: 'applied', label: 'Applied' },
  { value: 'admitted', label: 'Admitted' },
  { value: 'rejected', label: 'Rejected' },
];

function formatLakh(amount: number): string {
  return `₹${(amount / 100000).toFixed(2)} L`;
}

interface SavedCollegeCardProps {
  item: SavedCollegeView;
  onRemove: (collegeId: string) => void;
  onStatusChange: (collegeId: string, status: BookmarkStatus) => void;
  onAddNote: (collegeId: string, text: string) => void;
  onRemoveNote: (collegeId: string, noteId: string) => void;
  isSelectedForCompare: boolean;
  onToggleCompare: (collegeId: string) => void;
  compareDisabled: boolean;
}

export function SavedCollegeCard({
  item, onRemove, onStatusChange, onAddNote, onRemoveNote, isSelectedForCompare, onToggleCompare, compareDisabled,
}: SavedCollegeCardProps) {
  const { college, enrichment } = item;
  const [notesOpen, setNotesOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const latestPlacement = college.placementSummary?.[college.placementSummary.length - 1];
  const hasHostel = college.hostelInfo?.boysHostel || college.hostelInfo?.girlsHostel;
  const primaryCourse = college.courses?.[0];
  const href = `/colleges/${college.slug}`;

  const submitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteDraft.trim()) return;
    onAddNote(item.collegeId, noteDraft.trim());
    setNoteDraft('');
  };

  return (
    <div className="card-editorial colleges-card wishlist-card colleges-card--clickable" style={{ position: 'relative' }}>

      {/* Full-card overlay link — interactive controls sit above via z-index:2 */}
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
        {college.logo && <img src={college.logo} alt={`${college.name} logo`} loading="lazy" className="colleges-card-logo" />}

        <div className="colleges-card-badges-top">
          {college.accreditation?.nirfRank && <span className="colleges-badge colleges-badge-dark">NIRF #{college.accreditation.nirfRank}</span>}
          <span className="colleges-badge colleges-badge-accent">AI Score {enrichment.aiRecommendationScore}</span>
        </div>

        {/* Remove button — absolutely positioned by CSS (.colleges-card-favorite).
            e.stopPropagation() prevents the overlay link from also firing. */}
        <button
          type="button"
          className="colleges-card-favorite"
          aria-pressed
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(item.collegeId); }}
          aria-label={`Remove ${college.name} from wishlist`}
          title="Remove from wishlist"
        >
          ❤️
        </button>
      </div>

      <div className="colleges-card-body">
        <div className="colleges-card-title-row">
          <h3 className="font-serif colleges-card-title">{college.name}</h3>
          <span className="colleges-badge colleges-badge-outline">{college.collegeType}</span>
        </div>
        <span className="colleges-card-location">
          📍 {college.city}{college.district ? `, ${college.district}` : ''} • {primaryCourse?.name ?? 'Multiple courses'}
        </span>

        {/* Status chips — raised above overlay link */}
        <div className="wishlist-status-row" role="radiogroup" aria-label="Bookmark status" style={{ position: 'relative', zIndex: 2 }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="wishlist-status-chip"
              data-active={item.status === opt.value}
              onClick={() => onStatusChange(item.collegeId, opt.value)}
              aria-pressed={item.status === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="colleges-card-stats wishlist-card-stats">
          <div>
            <span className="colleges-card-stat-label">Avg / Highest Package</span>
            <strong className="colleges-card-stat-value">
              {latestPlacement ? `₹${latestPlacement.averagePackage} / ₹${latestPlacement.highestPackage} LPA` : 'N/A'}
            </strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Annual Fee</span>
            <strong className="colleges-card-stat-value colleges-card-stat-accent">{formatLakh(college.feeBreakdown?.totalAnnualFee ?? 0)}</strong>
          </div>
          <div>
            <span className="colleges-card-stat-label">Hostel</span>
            <strong className="colleges-card-stat-value">{hasHostel ? 'Available' : 'Not Available'}</strong>
          </div>
        </div>

        <div className="colleges-card-chips wishlist-signal-chips">
          <span className="colleges-badge-editorial-sm">
            🎯 Admission {enrichment.admissionProbability != null ? `${enrichment.admissionProbability}%` : 'Not calculated'}
          </span>
          <span className="colleges-badge-editorial-sm">
            💰 ROI {enrichment.roiPercent != null ? `${enrichment.roiPercent}%` : 'Not calculated'}
          </span>
          <span className="colleges-badge-editorial-sm">
            🎓 {enrichment.scholarshipEligible ? `${enrichment.scholarshipCount} Scholarship${enrichment.scholarshipCount === 1 ? '' : 's'}` : 'No scholarship match'}
          </span>
          {enrichment.budgetFit != null && (
            <span className="colleges-badge-editorial-sm">{enrichment.budgetFit ? '✅ Within Budget' : '⚠️ Over Budget'}</span>
          )}
        </div>

        {/* Notes section — raised above overlay link */}
        <div className="wishlist-notes" style={{ position: 'relative', zIndex: 2 }}>
          <button type="button" className="wishlist-notes-toggle" onClick={() => setNotesOpen((v) => !v)}>
            📝 Notes ({item.notes.length}) {notesOpen ? '▲' : '▼'}
          </button>
          {notesOpen && (
            <div className="wishlist-notes-panel">
              {item.notes.map((note) => (
                <div key={note.id} className="wishlist-note-row">
                  <span>{note.text}</span>
                  <button type="button" onClick={() => onRemoveNote(item.collegeId, note.id)} aria-label="Remove note">✕</button>
                </div>
              ))}
              <form onSubmit={submitNote} className="wishlist-note-form">
                <input
                  type="text"
                  className="input-editorial"
                  placeholder="e.g. Visit campus, talk to seniors…"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <button type="submit" className="btn-editorial-secondary">Add</button>
              </form>
            </div>
          )}
        </div>

        {/* Actions — raised above overlay link */}
        <div className="wishlist-card-actions" style={{ position: 'relative', zIndex: 2 }}>
          <Link href={href} className="btn-editorial-primary colleges-card-cta wishlist-action-primary">
            View Details
          </Link>
          <div className="wishlist-action-row">
            <Link href="/predictions" className="btn-editorial-secondary wishlist-action-half">
              Predict Admission
            </Link>
            <Link href={`/financial-planner?collegeId=${item.collegeId}&courseId=${primaryCourse?.courseId ?? ''}`} className="btn-editorial-secondary wishlist-action-half">
              Financial Analysis
            </Link>
          </div>
          <label className="colleges-card-compare wishlist-action-compare">
            <input
              type="checkbox"
              checked={isSelectedForCompare}
              disabled={compareDisabled && !isSelectedForCompare}
              onChange={() => onToggleCompare(item.collegeId)}
              aria-label={`Add ${college.name} to comparison`}
            />
            Add to Compare
          </label>
        </div>
      </div>
    </div>
  );
}
