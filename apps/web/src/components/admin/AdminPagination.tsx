'use client';

import React from 'react';

interface AdminPaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}

export function AdminPagination({ page, totalPages, onChange }: AdminPaginationProps) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  const items: (number | 'ellipsis')[] = [];
  let last = 0;
  for (const p of pages) {
    if (last && p - last > 1) items.push('ellipsis');
    items.push(p);
    last = p;
  }

  return (
    <div className="admin-pagination">
      <button className="admin-pagination-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">‹</button>
      {items.map((item, idx) => item === 'ellipsis'
        ? <span key={`e${idx}`} style={{ color: 'var(--text-muted)', fontSize: '12px' }}>…</span>
        : (
          <button
            key={item}
            className="admin-pagination-btn"
            data-active={item === page || undefined}
            onClick={() => onChange(item)}
            aria-current={item === page ? 'page' : undefined}
          >
            {item}
          </button>
        ))}
      <button className="admin-pagination-btn" disabled={page >= totalPages} onClick={() => onChange(page + 1)} aria-label="Next page">›</button>
    </div>
  );
}
