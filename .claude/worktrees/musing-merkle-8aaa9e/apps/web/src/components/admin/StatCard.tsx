'use client';

import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
}

export function StatCard({ label, value, trend }: StatCardProps) {
  return (
    <div className="card-editorial admin-kpi-card">
      <span className="admin-kpi-label">{label}</span>
      <span className="font-serif admin-kpi-value">{value}</span>
      {trend && <span className="admin-kpi-trend">{trend}</span>}
    </div>
  );
}
