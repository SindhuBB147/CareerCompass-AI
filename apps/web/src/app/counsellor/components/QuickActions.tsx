'use client';
import { useRouter } from 'next/navigation';
import type { ActionButtonSpec } from '../../../hooks/useAiCounsellorChat';

const ACTION_ROUTES: Record<string, string> = {
  compare_colleges: '/colleges',
  predict_admission: '/predictions',
  generate_choice_list: '/predictions',
  apply_scholarship: '/scholarships',
  financial_planner: '/financial-planner',
  view_roadmap: '/roadmap',
};

export function QuickActions({ actions }: { actions: ActionButtonSpec[] }) {
  const router = useRouter();
  if (actions.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '14px' }}>
      {actions.map(action => (
        <button
          key={action.action}
          onClick={() => router.push(ACTION_ROUTES[action.action] ?? '/colleges')}
          className="btn-editorial-secondary"
          style={{ padding: '8px 18px', fontSize: '13px' }}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
