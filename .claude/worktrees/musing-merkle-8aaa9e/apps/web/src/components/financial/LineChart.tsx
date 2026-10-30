'use client';

export interface LinePoint {
  label: string;
  value: number;
}

export function LineChart({ data, height = 200, color = 'var(--accent-blue)' }: { data: LinePoint[]; height?: number; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const min = Math.min(...data.map(d => d.value), 0);
  const range = max - min || 1;
  const stepX = 100 / (data.length - 1);
  const padY = 16;
  const plotHeight = height - padY * 2;

  const points = data.map((d, i) => {
    const x = i * stepX;
    const y = padY + plotHeight - ((d.value - min) / range) * plotHeight;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width: '100%', height: `${height}px`, overflow: 'visible' }}>
        <path d={areaPath} fill={color} opacity={0.08} stroke="none" />
        <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={1.8} fill={color} />
        ))}
      </svg>
      <div style={{ display: 'flex', marginTop: '4px' }}>
        {data.map(d => (
          <div key={d.label} style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>{d.label}</div>
        ))}
      </div>
    </div>
  );
}
