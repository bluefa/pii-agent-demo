'use client';

import type { DashboardFilters } from '@/app/components/features/dashboard/types';
import { FilterIcon } from '@/app/components/ui/icons';
import {
  ExportButton,
  IntegrationFilter,
  SearchField,
  StatusFilter,
  SvcInstalledFilter,
} from '@/app/components/features/dashboard/systems-table-filters';
import { DEFAULT_FILTERS } from '@/app/components/features/dashboard/systems-table-filters/constants';

interface SystemsTableFiltersProps {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
  onExport: () => void;
}

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

  return (
    <div className="flex items-center justify-between gap-4">
      <SearchField
        value={filters.search}
        onChange={(search) => onChange({ ...filters, search, page: 0 })}
      />

      <div className="flex items-center gap-2.5">
        {hasActiveFilter && (
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#eff6ff', color: '#0064FF' }}
          >
            <FilterIcon />
            <span>필터 {activeFilterCount}개</span>
          </div>
        )}

        <IntegrationFilter
          value={filters.integration_method}
          onChange={(integration_method) =>
            onChange({ ...filters, integration_method, page: 0 })
          }
        />

        <StatusFilter
          value={filters.connection_status}
          onChange={(connection_status) =>
            onChange({ ...filters, connection_status, page: 0 })
          }
        />

        <SvcInstalledFilter
          value={filters.svc_installed}
          onChange={(svc_installed) =>
            onChange({ ...filters, svc_installed, page: 0 })
          }
        />

        <div className="w-px h-6 mx-0.5" style={{ backgroundColor: '#e5e7eb' }} />

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

        <ExportButton onClick={onExport} />
      </div>
    </div>
  );
};

export default SystemsTableFilters;
