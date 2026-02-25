'use client';

import { useState, useRef, useEffect } from 'react';
import type { DashboardFilters } from '@/app/components/features/dashboard/types';

interface SystemsTableFiltersProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onExport: () => void;
}

const INTEGRATION_OPTIONS = ['AWS', 'Azure', 'GCP', 'IDC', 'SDU', '수동조사'];
const STATUS_OPTIONS: { label: string; value: DashboardFilters['connection_status'] }[] = [
  { label: '전체', value: 'all' },
  { label: 'Healthy만', value: 'healthy' },
  { label: 'Unhealthy 포함', value: 'unhealthy' },
  { label: '미연동', value: 'none' },
];

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
    <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 2v8m0 0L5 7m3 3l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 12h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const FilterIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 3.5h10M4 7h6M5.5 10.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

const SVC_INSTALLED_OPTIONS: { label: string; value: DashboardFilters['svc_installed'] }[] = [
  { label: '전체', value: 'all' },
  { label: '설치완료', value: 'true' },
  { label: '미설치', value: 'false' },
];

const DEFAULT_FILTERS: Omit<DashboardFilters, 'page' | 'size'> = {
  search: '',
  integration_method: [],
  connection_status: 'all',
  svc_installed: 'all',
  sort_by: '',
  sort_order: 'none',
};

const SystemsTableFilters = ({ filters, onChange, onExport }: SystemsTableFiltersProps) => {
  const hasActiveFilter =
    filters.search !== '' ||
    filters.integration_method.length > 0 ||
    filters.connection_status !== 'all' ||
    filters.svc_installed !== 'all';

  const activeFilterCount =
    (filters.search !== '' ? 1 : 0) +
    (filters.integration_method.length > 0 ? 1 : 0) +
    (filters.connection_status !== 'all' ? 1 : 0) +
    (filters.svc_installed !== 'all' ? 1 : 0);

  const [methodOpen, setMethodOpen] = useState(false);
  const methodRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (methodRef.current && !methodRef.current.contains(e.target as Node)) {
        setMethodOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (value: string) => {
    onChange({ ...filters, search: value, page: 0 });
  };

  const handleMethodToggle = (method: string) => {
    const current = filters.integration_method;
    const next = current.includes(method)
      ? current.filter((m) => m !== method)
      : [...current, method];
    onChange({ ...filters, integration_method: next, page: 0 });
  };

  const handleStatusChange = (value: DashboardFilters['connection_status']) => {
    onChange({ ...filters, connection_status: value, page: 0 });
  };

  const methodLabel =
    filters.integration_method.length === 0
      ? '연동방식'
      : filters.integration_method.length === 1
        ? filters.integration_method[0]
        : `연동방식 (${filters.integration_method.length})`;

  return (
    <div className="flex items-center justify-between gap-4">
      {/* Search */}
      <div className="relative w-80">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }}>
          <SearchIcon />
        </div>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="검색..."
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl transition-all duration-200 outline-none"
          style={{
            border: '1.5px solid #e5e7eb',
            color: '#111827',
            backgroundColor: '#f9fafb',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#0064FF';
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 100, 255, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = '#e5e7eb';
            e.currentTarget.style.backgroundColor = '#f9fafb';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2.5">
        {/* Active filter count badge */}
        {hasActiveFilter && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#eff6ff', color: '#0064FF' }}
          >
            <FilterIcon />
            <span>필터 {activeFilterCount}개</span>
          </div>
        )}

        {/* Integration method multi-select */}
        <div className="relative" ref={methodRef}>
          <button
            type="button"
            onClick={() => setMethodOpen(!methodOpen)}
            className="flex items-center gap-2 px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200"
            style={{
              border: methodOpen
                ? '1.5px solid #0064FF'
                : filters.integration_method.length > 0
                  ? '1.5px solid #0064FF'
                  : '1.5px solid #e5e7eb',
              color: filters.integration_method.length > 0 ? '#0064FF' : '#374151',
              backgroundColor: filters.integration_method.length > 0 ? '#eff6ff' : '#ffffff',
              boxShadow: methodOpen ? '0 0 0 3px rgba(0, 100, 255, 0.1)' : 'none',
            }}
          >
            <span>{methodLabel}</span>
            <span
              className="transition-transform duration-200"
              style={{
                transform: methodOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                color: '#9ca3af',
              }}
            >
              <ChevronDownIcon />
            </span>
          </button>

          {methodOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-52 rounded-xl z-20 py-1.5 overflow-hidden"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
              }}
            >
              {INTEGRATION_OPTIONS.map((option) => {
                const isChecked = filters.integration_method.includes(option);
                return (
                  <label
                    key={option}
                    className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors duration-150"
                    style={{ color: '#374151' }}
                    onClick={() => handleMethodToggle(option)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div
                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all duration-150"
                      style={{
                        backgroundColor: isChecked ? '#0064FF' : '#ffffff',
                        border: isChecked ? '2px solid #0064FF' : '2px solid #d1d5db',
                      }}
                    >
                      {isChecked && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    {option}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Status select */}
        <select
          value={filters.connection_status}
          onChange={(e) => handleStatusChange(e.target.value as DashboardFilters['connection_status'])}
          className="px-3.5 py-2.5 text-sm rounded-xl cursor-pointer transition-all duration-200 outline-none appearance-none pr-8"
          style={{
            border: filters.connection_status !== 'all'
              ? '1.5px solid #0064FF'
              : '1.5px solid #e5e7eb',
            color: filters.connection_status !== 'all' ? '#0064FF' : '#374151',
            backgroundColor: filters.connection_status !== 'all' ? '#eff6ff' : '#ffffff',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3.5 5.25L7 8.75L10.5 5.25' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
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

        {/* svcInstalled select */}
        <select
          value={filters.svc_installed}
          onChange={(e) => onChange({ ...filters, svc_installed: e.target.value as DashboardFilters['svc_installed'], page: 0 })}
          className="px-3.5 py-2.5 text-sm rounded-xl cursor-pointer transition-all duration-200 outline-none appearance-none pr-8"
          style={{
            border: filters.svc_installed !== 'all'
              ? '1.5px solid #0064FF'
              : '1.5px solid #e5e7eb',
            color: filters.svc_installed !== 'all' ? '#0064FF' : '#374151',
            backgroundColor: filters.svc_installed !== 'all' ? '#eff6ff' : '#ffffff',
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='14' height='14' viewBox='0 0 14 14' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3.5 5.25L7 8.75L10.5 5.25' stroke='%239ca3af' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
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

        {/* Divider */}
        <div className="w-px h-6 mx-0.5" style={{ backgroundColor: '#e5e7eb' }} />

        {/* Reset */}
        {hasActiveFilter && (
          <button
            type="button"
            onClick={() => onChange({ ...filters, ...DEFAULT_FILTERS, page: 0 })}
            className="px-3 py-2 text-sm font-medium transition-colors duration-200"
            style={{ color: '#6b7280' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#111827';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#6b7280';
            }}
          >
            초기화
          </button>
        )}

        {/* CSV Export */}
        <button
          type="button"
          onClick={onExport}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
          style={{
            background: 'linear-gradient(135deg, #0064FF 0%, #4f46e5 100%)',
            color: '#ffffff',
            boxShadow: '0 1px 3px 0 rgba(0, 100, 255, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = '0 4px 12px -2px rgba(0, 100, 255, 0.4)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = '0 1px 3px 0 rgba(0, 100, 255, 0.3)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <DownloadIcon />
          CSV 추출
        </button>
      </div>
    </div>
  );
};

export default SystemsTableFilters;
