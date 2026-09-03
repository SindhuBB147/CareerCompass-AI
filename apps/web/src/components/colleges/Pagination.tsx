'use client';

import React from 'react';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  const items: (number | 'ellipsis')[] = [];
  let last = 0;
  for (const p of pages) {
    if (last && p - last > 1) items.push('ellipsis');
    items.push(p);
    last = p;
  }

  return (
    <nav className="colleges-pagination" aria-label="Pagination">
      <button
        type="button"
        className="btn-editorial-secondary colleges-pagination-btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        ← Prev
      </button>

      <div className="colleges-pagination-pages">
        {items.map((item, idx) =>
          item === 'ellipsis' ? (
            <span key={`e${idx}`} className="colleges-pagination-ellipsis">…</span>
          ) : (
            <button
              key={item}
              type="button"
              className="colleges-pagination-page"
              data-active={item === page || undefined}
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onChange(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        className="btn-editorial-secondary colleges-pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        Next →
      </button>
    </nav>
  );
}
