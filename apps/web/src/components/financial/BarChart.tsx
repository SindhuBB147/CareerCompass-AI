'use client';

// Minimal hand-rolled inline-SVG bar chart — no charting library exists
// anywhere in this repo (confirmed), so this stays dependency-free and
// themes via the site's own CSS vars rather than a hardcoded palette.

export interface ChartDatum {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({ data, height = 220 }: { data: ChartDatum[]; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: `${height}px`, overflow: 'visible' }}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 30);
          const x = i * barWidth + barWidth * 0.15;
          const w = barWidth * 0.7;
          const y = height - 20 - barHeight;
          return (
            <g key={d.label}>
              <rect x={x} y={y} width={w} height={barHeight} rx={1.5} fill={d.color ?? 'var(--accent-blue)'} />
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', marginTop: '4px' }}>
        {data.map(d => (
          <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 2px' }} title={d.label}>
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}
