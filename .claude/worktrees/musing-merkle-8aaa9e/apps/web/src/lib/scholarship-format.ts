export function formatAward(award: { type: 'fixed' | 'percentage'; value: number; displayText?: string }): string {
  if (award.displayText) return award.displayText;
  if (award.type === 'percentage') return `${award.value}% Fee Waiver`;
  return `₹${award.value.toLocaleString('en-IN')}`;
}

export type DeadlineStatus = 'open' | 'closing-soon' | 'upcoming' | 'expired';

export function deadlineStatus(deadline: string, opensAt?: string): { status: DeadlineStatus; label: string; daysRemaining: number } {
  const now = new Date();
  const closes = new Date(deadline);
  const opens = opensAt ? new Date(opensAt) : undefined;
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.ceil((closes.getTime() - now.getTime()) / msPerDay);

  if (closes.getTime() <= now.getTime()) {
    return { status: 'expired', label: 'Closed', daysRemaining: 0 };
  }
  if (opens && opens.getTime() > now.getTime()) {
    const daysToOpen = Math.ceil((opens.getTime() - now.getTime()) / msPerDay);
    return { status: 'upcoming', label: `Opens in ${daysToOpen}d`, daysRemaining };
  }
  if (daysRemaining <= 7) {
    return { status: 'closing-soon', label: `${daysRemaining}d left`, daysRemaining };
  }
  return { status: 'open', label: `${daysRemaining}d left`, daysRemaining };
}
