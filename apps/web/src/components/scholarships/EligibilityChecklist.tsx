'use client';

import type { EligibilityCheck } from '../../lib/scholarships-api';

const ICONS: Record<string, string> = { pass: '✓', fail: '✕', unknown: '?' };

export function EligibilityChecklist({ checks }: { checks: EligibilityCheck[] }) {
  return (
    <div className="scholarship-check-list">
      {checks.map(check => (
        <div key={check.key} className="scholarship-check-item" data-result={check.result}>
          <span className="scholarship-check-icon">{ICONS[check.result]}</span>
          <span>
            <span className="scholarship-check-label">{check.label}: </span>
            <span className="scholarship-check-message">{check.message}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
