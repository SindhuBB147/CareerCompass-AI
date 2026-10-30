'use client';
import { useRouter } from 'next/navigation';
import { BarChart3, GraduationCap, ListChecks, Map, Scale, Wallet } from 'lucide-react';
import type { ActionButtonSpec } from '../../../hooks/useAiCounsellorChat';

const ACTION_ROUTES: Record<string, string> = {
  compare_colleges: '/colleges',
  predict_admission: '/predictions',
  generate_choice_list: '/predictions',
  apply_scholarship: '/scholarships',
  financial_planner: '/financial-planner',
  view_roadmap: '/roadmap',
};

const ACTION_ICONS: Record<string, typeof Scale> = {
  compare_colleges: Scale,
  predict_admission: BarChart3,
  generate_choice_list: ListChecks,
  apply_scholarship: GraduationCap,
  financial_planner: Wallet,
  view_roadmap: Map,
};

function targetUrl(action: ActionButtonSpec): string {
  const base = ACTION_ROUTES[action.action] ?? '/colleges';
  const query = new URLSearchParams(action.params).toString();
  return query ? `${base}?${query}` : base;
}

export function QuickActions({ actions }: { actions: ActionButtonSpec[] }) {
  const router = useRouter();
  if (actions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
      {actions.map(action => {
        const Icon = ACTION_ICONS[action.action];
        return (
          <button
            key={action.action}
            onClick={() => router.push(targetUrl(action))}
            className="btn-editorial-secondary"
            style={{ padding: '8px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {Icon && <Icon size={14} aria-hidden="true" style={{ flexShrink: 0 }} />} {action.label}
          </button>
        );
      })}
    </div>
  );
}
