'use client';

import type { DashboardFilters } from '@/app/components/features/dashboard/types';
import { SELECT_CHEVRON_BG, SVC_INSTALLED_OPTIONS } from './constants';

interface SvcInstalledFilterProps {
  value: DashboardFilters['svc_installed'];
  onChange: (value: DashboardFilters['svc_installed']) => void;
}

export const SvcInstalledFilter = ({ value, onChange }: SvcInstalledFilterProps) => {
  const active = value !== 'all';
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DashboardFilters['svc_installed'])}
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
      {SVC_INSTALLED_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
