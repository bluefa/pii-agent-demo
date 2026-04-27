'use client';

import type { DashboardSummary } from '@/app/components/features/dashboard/types';

interface KpiCardGridProps {
  data: DashboardSummary | null;
  loading: boolean;
}

const ServerIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
    <rect x="3" y="14" width="18" height="7" rx="1.5" stroke="white" strokeWidth="1.8" />
    <circle cx="7" cy="6.5" r="1" fill="white" />
    <circle cx="7" cy="17.5" r="1" fill="white" />
    <line x1="16" y1="6.5" x2="18" y2="6.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="16" y1="17.5" x2="18" y2="17.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const SyncIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 4l2.5 2.5L17 9" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 6.5h14" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M7 20l-2.5-2.5L7 15" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M19 17.5H5" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const DatabaseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="12" cy="6" rx="7" ry="3" stroke="white" strokeWidth="1.8" />
    <path d="M5 6v5c0 1.66 3.13 3 7 3s7-1.34 7-3V6" stroke="white" strokeWidth="1.8" />
    <path d="M5 11v5c0 1.66 3.13 3 7 3s7-1.34 7-3v-5" stroke="white" strokeWidth="1.8" />
  </svg>
);

const fmt = (n: number): string => n.toLocaleString('ko-KR');

const cardShadow = '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)';
const cardHoverShadow = '0 4px 12px -2px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.06)';

const SkeletonCard = () => (
  <div
    className="rounded-2xl p-6"
    style={{ backgroundColor: '#ffffff', boxShadow: cardShadow }}
  >
    <div className="w-12 h-12 rounded-xl animate-pulse" style={{ backgroundColor: '#e5e7eb' }} />
    <div className="h-4 w-24 rounded animate-pulse mt-4" style={{ backgroundColor: '#e5e7eb' }} />
    <div className="h-8 w-16 rounded animate-pulse mt-2" style={{ backgroundColor: '#e5e7eb' }} />
    <div className="h-3 w-32 rounded animate-pulse mt-3" style={{ backgroundColor: '#f3f4f6' }} />
  </div>
);

const KpiCardGrid = ({ data, loading }: KpiCardGridProps) => {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Card 1: 서비스 현황 */}
      <div
        className="rounded-2xl p-6 transition-all duration-200 cursor-default"
        style={{ backgroundColor: '#ffffff', boxShadow: cardShadow }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = cardHoverShadow;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = cardShadow;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}
          >
            <ServerIcon />
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold" style={{ color: '#0064FF' }}>
              {data.service_connection_rate.toFixed(1)}%
            </p>
            <p className="text-[10px] font-medium" style={{ color: '#9ca3af' }}>연동률</p>
          </div>
        </div>
        <p className="text-sm font-medium mt-4" style={{ color: '#6b7280' }}>서비스 현황</p>
        <p className="text-[28px] font-bold leading-tight tracking-tight mt-1" style={{ color: '#111827' }}>
          {fmt(data.total_system_count)}
          <span className="text-sm font-normal ml-1.5" style={{ color: '#9ca3af' }}>시스템</span>
        </p>
        <div className="flex items-center gap-1.5 mt-3">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#dc2626' }} />
            끊어진 서비스 {fmt(data.unhealthy_service_count)}
          </span>
        </div>
      </div>

      {/* Card 2: DB 연동 현황 */}
      <div
        className="rounded-2xl p-6 transition-all duration-200 cursor-default"
        style={{ backgroundColor: '#ffffff', boxShadow: cardShadow }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = cardHoverShadow;
          e.currentTarget.style.transform = 'translateY(-2px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = cardShadow;
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
          >
            <SyncIcon />
          </div>
          <div className="text-right">
            <p className="text-[22px] font-bold" style={{ color: '#0064FF' }}>
              {data.connection_rate.toFixed(1)}%
            </p>
            <p className="text-[10px] font-medium" style={{ color: '#9ca3af' }}>연동률</p>
          </div>
        </div>
        <p className="text-sm font-medium mt-4" style={{ color: '#6b7280' }}>DB 연동 현황</p>
        <p className="text-[28px] font-bold leading-tight tracking-tight mt-1" style={{ color: '#111827' }}>
          {fmt(data.active_integration_db_count)}
          <span className="text-sm font-normal ml-1.5" style={{ color: '#9ca3af' }}>연동중</span>
        </p>
        <div className="flex items-center gap-1.5 mt-3">
          <span
            className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#dc2626' }} />
            끊김 {fmt(data.unhealthy_db_count)}
          </span>
        </div>
      </div>

    </div>
  );
};

export default KpiCardGrid;
