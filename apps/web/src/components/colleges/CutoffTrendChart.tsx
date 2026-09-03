'use client';

import React from 'react';
import type { CutoffRow } from '../../lib/colleges-api';

interface CutoffTrendChartProps {
  rows: CutoffRow[];
}

// Lightweight inline-SVG bar chart — no charting library dependency exists
// in this app, and pulling one in for a single chart isn't worth it. Groups
// by year, keeping the latest counselling round per year (most authoritative
// closing rank).
export function CutoffTrendChart({ rows }: CutoffTrendChartProps) {
  const byYear = new Map<number, CutoffRow>();
  for (const row of rows) {
    const existing = byYear.get(row.year);
    if (!existing || row.round >= existing.round) byYear.set(row.year, row);
  }
  const points = Array.from(byYear.values()).sort((a, b) => a.year - b.year);

  if (points.length === 0) {
    return <p className="text-body colleges-cutoff-empty">No cutoff data on file yet for this selection.</p>;
  }

  const maxRank = Math.max(...points.map((p) => p.closingRank), 1);
  const width = 640;
  const height = 220;
  const padding = { top: 20, right: 20, bottom: 36, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const barGap = 24;
  const barWidth = points.length > 0 ? Math.min(72, (chartW - barGap * (points.length - 1)) / points.length) : 0;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="colleges-cutoff-chart" role="img" aria-label="Closing rank trend by year">
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="var(--border-color)" />
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--border-color)" />

      {[0, 0.5, 1].map((frac) => {
        const y = padding.top + chartH * (1 - frac);
        const label = Math.round(maxRank * frac);
        return (
          <g key={frac}>
            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-color)" strokeDasharray="4 4" opacity={0.5} />
            <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{label}</text>
          </g>
        );
      })}

      {points.map((p, idx) => {
        const barH = (p.closingRank / maxRank) * chartH;
        const x = padding.left + idx * (barWidth + barGap) + barGap / 2;
        const y = height - padding.bottom - barH;
        return (
          <g key={p.year}>
            <rect x={x} y={y} width={barWidth} height={barH} rx={8} fill="var(--accent-blue)" />
            <text x={x + barWidth / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--text-primary)">
              #{p.closingRank}
            </text>
            <text x={x + barWidth / 2} y={height - padding.bottom + 18} textAnchor="middle" fontSize={12} fill="var(--text-secondary)">
              {p.year} · R{p.round}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
