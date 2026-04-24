'use client';

import type { DashboardFilters } from '@/app/components/features/dashboard/types';
import { SELECT_CHEVRON_BG, STATUS_OPTIONS } from './constants';

interface StatusFilterProps {
  value: DashboardFilters['connection_status'];
  onChange: (value: DashboardFilters['connection_status']) => void;
}

export const StatusFilter = ({ value, onChange }: StatusFilterProps) => {
  const active = value !== 'all';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DashboardFilters['connection_status'])}
      className="px-3.5 py-2.5 text-sm rounded-xl cursor-pointer transition-all duration-200 outline-none appearance-none pr-8"
      style={{
        border: active ? '1.5px solid #0064FF' : '1.5px solid #e5e7eb',
        color: active ? '#0064FF' : '#374151',
        backgroundColor: active ? '#eff6ff' : '#ffffff',
        backgroundImage: SELECT_CHEVRON_BG,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
