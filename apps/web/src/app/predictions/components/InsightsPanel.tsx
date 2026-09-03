'use client';

export function InsightsPanel({ insights }: { insights: string[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="card-editorial" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--bg-main)' }}>
      <h4 className="font-serif" style={{ fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
        💡 Smart Insights
      </h4>
      <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {insights.map((insight, i) => (
          <li key={i} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{insight}</li>
        ))}
      </ul>
    </div>
  );
}
