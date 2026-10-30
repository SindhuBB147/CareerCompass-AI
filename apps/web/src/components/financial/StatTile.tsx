'use client';

// Thin wrapper around the existing .colleges-stat-box(-dark) pattern
// (used on college/scholarship detail pages) — no new CSS needed, just a
// consistent props shape for the financial module's KPI tiles.

export function StatTile({
  label,
  value,
  emphasis,
  sub,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
  sub?: string;
}) {
  return (
    <div className={emphasis ? 'colleges-stat-box colleges-stat-box-dark' : 'colleges-stat-box'}>
      <span className="colleges-stat-box-label">{label}</span>
      <div className="font-serif colleges-stat-box-value">{value}</div>
      {sub && <div style={{ fontSize: '12px', marginTop: '4px', opacity: 0.75 }}>{sub}</div>}
    </div>
  );
}
