'use client';

import { deadlineStatus } from '../../lib/scholarship-format';

export function DeadlineChip({ deadline, opensAt }: { deadline: string; opensAt?: string }) {
  const { status, label } = deadlineStatus(deadline, opensAt);
  return (
    <span className="scholarship-deadline-chip" data-status={status}>
      {status === 'expired' ? '⏹' : status === 'upcoming' ? '🕒' : status === 'closing-soon' ? '⚠️' : '✓'} {label}
    </span>
  );
}
