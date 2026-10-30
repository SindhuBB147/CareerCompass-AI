'use client';

import type { Roadmap } from '../../../lib/roadmap-api';
import { CATEGORY_LABELS, STATUS_LABELS } from '../roadmap-helpers';

/** Print-only view — hidden on screen, shown via the @media print rules in globals.css (mirrors PrintableReport.tsx's convention). */
export function RoadmapPrintable({ roadmap }: { roadmap: Roadmap }) {
  return (
    <div className="roadmap-print-report">
      <div className="roadmap-print-header">
        <h1 className="font-serif">{roadmap.careerName} — Career Roadmap</h1>
        <p>Generated {new Date(roadmap.generatedAt).toLocaleDateString('en-IN')} · {roadmap.analytics.completionPercent}% complete ({roadmap.analytics.completedCount}/{roadmap.analytics.totalCount} milestones)</p>
      </div>
      {roadmap.phases.map(phase => (
        <div key={phase.phaseKey} style={{ marginBottom: '20px', breakInside: 'avoid' }}>
          <h2 className="font-serif" style={{ fontSize: '20px' }}>{phase.label}</h2>
          <ul style={{ marginLeft: '18px' }}>
            {phase.milestones.map(m => (
              <li key={m.milestoneKey} style={{ marginBottom: '6px' }}>
                <strong>[{STATUS_LABELS[m.status]}]</strong> {m.title} — <em>{CATEGORY_LABELS[m.category]}</em>
                <div style={{ fontSize: '13px', color: '#444' }}>{m.description}</div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
