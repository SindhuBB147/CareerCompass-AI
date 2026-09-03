'use client';

import React from 'react';
import type { College } from '../../lib/colleges-api';
import { CollegeCard } from './CollegeCard';

interface CollegeGridProps {
  colleges: College[];
  isLoading: boolean;
  favorites: string[];
  onToggleFavorite: (id: string) => void;
  compareIds: string[];
  onToggleCompare: (id: string) => void;
  maxCompare: number;
  onResetFilters: () => void;
}

export function CollegeGrid({ colleges, isLoading, favorites, onToggleFavorite, compareIds, onToggleCompare, maxCompare, onResetFilters }: CollegeGridProps) {
  if (isLoading) {
    return (
      <div className="colleges-grid-cards" aria-busy="true" aria-label="Loading colleges">
        {[1, 2, 3, 4, 5, 6].map((idx) => (
          <div key={idx} className="card-editorial colleges-card-skeleton" />
        ))}
      </div>
    );
  }

  if (colleges.length === 0) {
    return (
      <div className="card-editorial colleges-empty-state">
        <div className="colleges-empty-icon">🏛️</div>
        <h3 className="font-serif colleges-empty-title">No Colleges Found</h3>
        <p className="text-body colleges-empty-desc">
          Try adjusting your search criteria or resetting active filters.
        </p>
        <button onClick={onResetFilters} className="btn-editorial-primary">
          Reset All Filters
        </button>
      </div>
    );
  }

  return (
    <div className="colleges-grid-cards">
      {colleges.map((college) => {
        const id = college.id || college._id;
        return (
          <CollegeCard
            key={id}
            college={college}
            isFavorite={favorites.includes(id)}
            onToggleFavorite={onToggleFavorite}
            isComparing={compareIds.includes(id)}
            onToggleCompare={onToggleCompare}
            compareDisabled={compareIds.length >= maxCompare}
          />
        );
      })}
    </div>
  );
}
