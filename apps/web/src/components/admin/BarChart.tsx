'use client';

import React from 'react';

export interface BarChartPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartPoint[];
  color?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

// Generic inline-SVG bar chart — no charting library dependency in this app.
export function BarChart({ data, color = 'var(--accent-blue)', height = 220, formatValue }: BarChartProps) {
  if (data.length === 0) {
    return <p className="admin-chart-empty">No data yet for this period.</p>;
  }

  const width = 640;
  const padding = { top: 20, right: 16, bottom: 40, left: 16 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const barGap = Math.min(16, chartW / data.length / 4);
  const barWidth = Math.max(4, (chartW - barGap * (data.length - 1)) / data.length);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="admin-bar-chart" role="img" aria-label="Bar chart">
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="var(--border-color)" />
      {data.map((d, idx) => {
        const barH = (d.value / maxVal) * chartH;
        const x = padding.left + idx * (barWidth + barGap);
        const y = height - padding.bottom - barH;
        return (
          <g key={idx}>
            <rect x={x} y={y} width={barWidth} height={Math.max(barH, 1)} rx={4} fill={color} opacity={0.85} />
            {data.length <= 14 && (
              <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--text-primary)">
                {formatValue ? formatValue(d.value) : d.value}
              </text>
            )}
            {data.length <= 14 && (
              <text x={x + barWidth / 2} y={height - padding.bottom + 16} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
                {d.label.length > 10 ? `${d.label.slice(0, 9)}…` : d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
