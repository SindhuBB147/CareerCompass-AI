'use client';

import type { RoadmapAnalytics } from '../../../lib/roadmap-api';

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card-editorial colleges-stat-box-dark" style={{ padding: '24px' }}>
      <div className="colleges-stat-box-label" style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div className="colleges-stat-box-value font-serif" style={{ fontSize: '32px', marginTop: '8px' }}>{value}</div>
    </div>
  );
}

export function AnalyticsView({ analytics }: { analytics: RoadmapAnalytics }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="roadmap-analytics-grid">
        <StatTile label="Overall Progress" value={`${analytics.completionPercent}%`} />
        <StatTile label="Milestones Completed" value={`${analytics.completedCount} / ${analytics.totalCount}`} />
        <StatTile label="In Progress" value={analytics.inProgressCount} />
        <StatTile label="Skill Score" value={analytics.skillScore} />
        <StatTile label="Learning Hours Logged" value={analytics.learningHoursLogged} />
        <StatTile label="Upcoming (next 4 weeks)" value={analytics.upcomingCount} />
      </div>

      {analytics.missedCount > 0 && (
        <div className="card-editorial" style={{ borderColor: '#C0392B', padding: '20px' }}>
          <strong style={{ color: '#C0392B' }}>{analytics.missedCount} milestone{analytics.missedCount === 1 ? ' is' : 's are'} past its estimated timeline.</strong>
          <p className="text-body" style={{ fontSize: '14px', margin: '4px 0 0' }}>That&apos;s fine — roadmaps are guides, not deadlines. Revisit the Timeline or Checklist view to re-prioritize.</p>
        </div>
      )}

      <div>
        <h3 className="font-serif" style={{ fontSize: '22px', marginBottom: '16px' }}>Achievements</h3>
        {analytics.achievements.length === 0 ? (
          <p className="text-body">Complete your first milestone to start earning achievements.</p>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {analytics.achievements.map(a => (
              <span key={a.key} className="badge-editorial" style={{ fontSize: '13px', padding: '8px 16px' }}>🏅 {a.label}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
