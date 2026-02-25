'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DashboardHeader,
  KpiCardGrid,
  SystemsTable,
  SystemsTableFilters,
} from '@/app/components/features/dashboard';
import type {
  DashboardSummary,
  SystemDetailListResponse,
  DashboardFilters,
} from '@/app/components/features/dashboard';

// ---------------------------------------------------------------------------
// Mock data — used when API is not available
// ---------------------------------------------------------------------------
const MOCK_SUMMARY: DashboardSummary = {
  total_system_count: 152,
  total_target_db_count: 1204,
  active_integration_db_count: 987,
  healthy_db_count: 964,
  unhealthy_db_count: 23,
  unhealthy_service_count: 8,
  service_connection_rate: 94.7,
  connection_rate: 82.0,
  checked_at: '2026-02-26T09:00:00Z',
};

const MOCK_SYSTEMS: SystemDetailListResponse = {
  systems: [
    {
      service_code: 'SVC-001',
      service_name: '통합 인사 시스템',
      manager: { name: '김민수', email: 'minsu.kim@example.com' },
      nirp_codes: ['N-101'],
      sw_plm_codes: ['PLM-201'],
      integration_methods: ['AWS'], svc_installed: true,
      db_status: { target_db_count: 12, healthy_db_count: 10, unhealthy_db_count: 2, active_db_count: 12 },
    },
    {
      service_code: 'SVC-002',
      service_name: '재무 관리 플랫폼',
      manager: { name: '이서연', email: 'seoyeon.lee@example.com' },
      nirp_codes: ['N-102', 'N-103'],
      sw_plm_codes: ['PLM-202'],
      integration_methods: ['Azure'], svc_installed: true,
      db_status: { target_db_count: 8, healthy_db_count: 8, unhealthy_db_count: 0, active_db_count: 8 },
    },
    {
      service_code: 'SVC-003',
      service_name: '고객 포털',
      manager: { name: '박준혁', email: 'junhyuk.park@example.com' },
      nirp_codes: ['N-104'],
      sw_plm_codes: ['PLM-203', 'PLM-204'],
      integration_methods: ['GCP', 'IDC'], svc_installed: true,
      db_status: { target_db_count: 20, healthy_db_count: 18, unhealthy_db_count: 2, active_db_count: 19 },
    },
    {
      service_code: 'SVC-004',
      service_name: '물류 추적 시스템',
      manager: { name: '정하은', email: 'haeun.jung@example.com' },
      nirp_codes: ['N-105'],
      sw_plm_codes: [],
      integration_methods: ['AWS'], svc_installed: true,
      db_status: { target_db_count: 6, healthy_db_count: 6, unhealthy_db_count: 0, active_db_count: 6 },
    },
    {
      service_code: 'SVC-005',
      service_name: 'CRM 분석 엔진',
      manager: { name: '최도윤', email: 'doyun.choi@example.com' },
      nirp_codes: [],
      sw_plm_codes: ['PLM-205'],
      integration_methods: ['SDU'], svc_installed: false,
      db_status: { target_db_count: 15, healthy_db_count: 12, unhealthy_db_count: 3, active_db_count: 14 },
    },
    {
      service_code: 'SVC-006',
      service_name: '그룹웨어',
      manager: { name: '한소희', email: 'sohee.han@example.com' },
      nirp_codes: ['N-106'],
      sw_plm_codes: ['PLM-206'],
      integration_methods: ['수동조사'], svc_installed: false,
      db_status: { target_db_count: 4, healthy_db_count: 4, unhealthy_db_count: 0, active_db_count: 0 },
    },
    {
      service_code: 'SVC-007',
      service_name: 'ERP 통합',
      manager: { name: '윤재원', email: 'jaewon.yun@example.com' },
      nirp_codes: ['N-107', 'N-108'],
      sw_plm_codes: ['PLM-207'],
      integration_methods: ['Azure', 'IDC'], svc_installed: true,
      db_status: { target_db_count: 30, healthy_db_count: 25, unhealthy_db_count: 5, active_db_count: 28 },
    },
    {
      service_code: 'SVC-008',
      service_name: '데이터 레이크',
      manager: { name: '서지민', email: 'jimin.seo@example.com' },
      nirp_codes: [],
      sw_plm_codes: ['PLM-208'],
      integration_methods: ['GCP'], svc_installed: true,
      db_status: { target_db_count: 50, healthy_db_count: 48, unhealthy_db_count: 2, active_db_count: 50 },
    },
    {
      service_code: 'SVC-009',
      service_name: 'AI/ML 플랫폼',
      manager: { name: '강예린', email: 'yerin.kang@example.com' },
      nirp_codes: ['N-109'],
      sw_plm_codes: [],
      integration_methods: ['AWS', 'GCP'], svc_installed: true,
      db_status: { target_db_count: 10, healthy_db_count: 7, unhealthy_db_count: 3, active_db_count: 9 },
    },
    {
      service_code: 'SVC-010',
      service_name: '보안 관제 시스템',
      manager: { name: '임태우', email: 'taewoo.lim@example.com' },
      nirp_codes: ['N-110'],
      sw_plm_codes: ['PLM-209', 'PLM-210'],
      integration_methods: ['IDC'], svc_installed: false,
      db_status: { target_db_count: 18, healthy_db_count: 12, unhealthy_db_count: 6, active_db_count: 16 },
    },
  ],
  total_count: 152,
  page: 0,
  size: 20,
  total_pages: 8,
};

const DEFAULT_FILTERS: DashboardFilters = {
  search: '',
  integration_method: [],
  connection_status: 'all',
  svc_installed: 'all',
  sort_by: '',
  sort_order: 'none',
  page: 0,
  size: 20,
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [systems, setSystems] = useState<SystemDetailListResponse | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>(DEFAULT_FILTERS);
  const [loading, setLoading] = useState(true);
  const [systemsLoading, setSystemsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/admin/dashboard/summary');
      if (!res.ok) throw new Error('summary fetch failed');
      const data: DashboardSummary = await res.json();
      setSummary(data);
    } catch {
      setSummary(MOCK_SUMMARY);
    }
  }, []);

  const fetchSystems = useCallback(async (f: DashboardFilters) => {
    setSystemsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(f.page),
        size: String(f.size),
      });
      if (f.search) params.set('search', f.search);
      if (f.integration_method.length > 0) params.set('integration_method', f.integration_method.join(','));
      if (f.connection_status !== 'all') params.set('connection_status', f.connection_status);
      if (f.svc_installed !== 'all') params.set('svc_installed', f.svc_installed);
      if (f.sort_by) {
        params.set('sort_by', f.sort_by);
        params.set('sort_order', f.sort_order === 'none' ? 'asc' : f.sort_order);
      }

      const res = await fetch(`/api/v1/admin/dashboard/systems?${params}`);
      if (!res.ok) throw new Error('systems fetch failed');
      const data: SystemDetailListResponse = await res.json();
      setSystems(data);
    } catch {
      setSystems(MOCK_SYSTEMS);
    } finally {
      setSystemsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([fetchSummary(), fetchSystems(DEFAULT_FILTERS)]);
      } catch {
        setError('데이터를 불러올 수 없습니다');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [fetchSummary, fetchSystems]);

  // Debounced search, immediate for other filter changes
  const handleFiltersChange = useCallback(
    (next: DashboardFilters) => {
      setFilters(next);

      const searchChanged = next.search !== filters.search;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

      if (searchChanged) {
        searchTimerRef.current = setTimeout(() => {
          fetchSystems(next);
        }, 300);
      } else {
        fetchSystems(next);
      }
    },
    [filters.search, fetchSystems],
  );

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.integration_method.length > 0) params.set('integration_method', filters.integration_method.join(','));
      if (filters.connection_status !== 'all') params.set('connection_status', filters.connection_status);
      if (filters.svc_installed !== 'all') params.set('svc_installed', filters.svc_installed);

      const res = await fetch(`/api/v1/admin/dashboard/systems/export?${params}`);
      if (!res.ok) throw new Error('export failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setExportError(true);
      setTimeout(() => setExportError(false), 3000);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    Promise.all([fetchSummary(), fetchSystems(filters)]).finally(() => setLoading(false));
  };

  if (error && !summary && !systems) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#f5f7fb' }}>
        <div className="max-w-[1400px] mx-auto px-8 py-10">
          <DashboardHeader />
          <div className="flex flex-col items-center justify-center py-32">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: '#fee2e2' }}
            >
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <circle cx="16" cy="16" r="12" stroke="#ef4444" strokeWidth="2" />
                <path d="M16 10v8" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
                <circle cx="16" cy="22" r="1.5" fill="#ef4444" />
              </svg>
            </div>
            <p className="text-base font-medium" style={{ color: '#374151' }}>{error}</p>
            <p className="text-sm mt-1 mb-5" style={{ color: '#9ca3af' }}>네트워크 연결을 확인하고 다시 시도해 주세요</p>
            <button
              type="button"
              onClick={handleRetry}
              className="px-5 py-2.5 text-sm font-medium rounded-xl transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, #0064FF 0%, #4f46e5 100%)',
                color: '#ffffff',
                boxShadow: '0 1px 3px 0 rgba(0, 100, 255, 0.3)',
              }}
            >
              다시 시도
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f7fb' }}>
      {/* Export error toast */}
      {exportError && (
        <div
          className="fixed top-4 right-4 z-50 flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
          style={{
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="#ef4444" strokeWidth="1.5" />
            <path d="M6 6l4 4M10 6l-4 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          CSV 내보내기에 실패했습니다
        </div>
      )}

      <div className="max-w-[1400px] mx-auto px-8 py-10">
        <DashboardHeader checkedAt={summary?.checked_at} />
        <KpiCardGrid data={summary} loading={loading} />

        {/* Systems Table Card */}
        <div
          className="mt-8 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
          }}
        >
          {/* Table header area */}
          <div
            className="px-6 py-5 flex items-center justify-between"
            style={{ borderBottom: '1px solid #f3f4f6' }}
          >
            <div>
              <h2 className="text-base font-semibold" style={{ color: '#111827' }}>시스템 목록</h2>
              <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                등록된 전체 시스템의 연동 현황
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #f3f4f6' }}>
            <SystemsTableFilters
              filters={filters}
              onChange={handleFiltersChange}
              onExport={handleExport}
            />
          </div>

          {/* Table */}
          <SystemsTable
            data={systems}
            loading={loading || systemsLoading}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>
      </div>
    </div>
  );
}
