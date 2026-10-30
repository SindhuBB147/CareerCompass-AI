'use client';

import React from 'react';
import Link from 'next/link';
import { MAX_COMPARE } from '../../lib/colleges-storage';

interface CompareBarProps {
  compareIds: string[];
  onClear: () => void;
}

export function CompareBar({ compareIds, onClear }: CompareBarProps) {
  if (compareIds.length === 0) return null;

  const canCompare = compareIds.length >= 2;

  return (
    <div className="colleges-compare-bar" role="status">
      <span className="colleges-compare-bar-text">
        {compareIds.length}/{MAX_COMPARE} Colleges Selected for Comparison
      </span>
      <button type="button" onClick={onClear} className="colleges-compare-bar-clear">
        Clear
      </button>
      {canCompare ? (
        <Link href={`/colleges/compare?ids=${compareIds.join(',')}`} className="btn-editorial-primary colleges-compare-bar-cta">
          Compare Now →
        </Link>
      ) : (
        <span className="colleges-compare-bar-hint">Select at least 2 to compare</span>
      )}
    </div>
  );
}
