'use client';

import type { ChartDatum } from './BarChart';

const DEFAULT_PALETTE = [
  'var(--accent-blue)', 'var(--text-primary)', '#7A9CB5', '#B5C9D6', '#3D5A73', '#9AAEB8', '#5E7A8C',
];

export function DonutChart({ data, size = 160 }: { data: ChartDatum[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  let offsetAccum = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 100 100" style={{ width: `${size}px`, height: `${size}px`, transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border-color)" strokeWidth="14" />
        {data.map((d, i) => {
          const fraction = d.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const circle = (
            <circle
              key={d.label}
              cx="50" cy="50" r={radius} fill="none"
              stroke={d.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]}
              strokeWidth="14"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={-offsetAccum}
              strokeLinecap="butt"
            />
          );
          offsetAccum += dash;
          return circle;
        })}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
        {data.map((d, i) => (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: d.color ?? DEFAULT_PALETTE[i % DEFAULT_PALETTE.length], display: 'inline-block' }} />
            <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
            <span style={{ fontWeight: 600 }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
