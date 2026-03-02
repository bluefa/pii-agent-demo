'use client';

import { useState } from 'react';
import {
  getConfirmedIntegration,
  getConfirmedIntegrationAthenaDatabases,
  getConfirmedIntegrationAthenaTables,
  type AthenaRegionResourceSummary,
  type ResourceSnapshotItem,
} from '@/app/lib/api';
import { AthenaReadonlyTree } from '@/app/components/features/process-status/AthenaReadonlyTree';
import { cn, statusColors, textColors, bgColors, tableStyles } from '@/lib/theme';

interface ConfirmedIntegrationCollapseProps {
  targetSourceId: number;
  label: string;
}

export const ConfirmedIntegrationCollapse = ({
  targetSourceId,
  label,
}: ConfirmedIntegrationCollapseProps) => {
  const [open, setOpen] = useState(false);
  const [resources, setResources] = useState<ResourceSnapshotItem[] | null>(null);
  const [athenaRegions, setAthenaRegions] = useState<AthenaRegionResourceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (!open && resources === null) {
      setLoading(true);
      try {
        const res = await getConfirmedIntegration(targetSourceId);
        setResources(res.confirmed_integration?.resource_infos ?? []);
        setAthenaRegions(res.confirmed_integration?.athena_region_resources ?? []);
      } catch {
        setResources([]);
        setAthenaRegions([]);
      } finally {
        setLoading(false);
      }
    }
    setOpen((prev) => !prev);
  };

  return (
    <div className="mt-3">
      <button
        onClick={handleToggle}
        className={cn(
          'flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors w-full',
          statusColors.pending.bg,
          statusColors.pending.textDark,
          'hover:opacity-80',
        )}
      >
        <svg
          className={cn('w-4 h-4 transition-transform', open && 'rotate-90')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {label}
      </button>

      {open && (
        <div className={cn('mt-2 border rounded-lg overflow-hidden', statusColors.pending.border)}>
          {loading ? (
            <div className={cn('px-3 py-4 text-sm text-center', textColors.tertiary)}>불러오는 중...</div>
          ) : (!resources || resources.length === 0) && athenaRegions.length === 0 ? (
            <div className={cn('px-3 py-4 text-sm text-center', textColors.quaternary)}>확정된 연동 정보가 없습니다</div>
          ) : (
            <div className="space-y-3 p-3">
              {!!resources && resources.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className={bgColors.muted}>
                      <tr>
                        <th className={cn('px-3 py-2 text-left text-xs font-medium', textColors.tertiary)}>리소스 ID</th>
                        <th className={cn('px-3 py-2 text-left text-xs font-medium', textColors.tertiary)}>유형</th>
                        <th className={cn('px-3 py-2 text-left text-xs font-medium', textColors.tertiary)}>Credential</th>
                      </tr>
                    </thead>
                    <tbody className={tableStyles.body}>
                      {resources.map((r) => (
                        <tr key={r.resource_id}>
                          <td className={cn('px-3 py-2 font-mono text-xs', textColors.secondary)}>{r.resource_id}</td>
                          <td className={cn('px-3 py-2 text-xs', textColors.tertiary)}>{r.resource_type}</td>
                          <td className={cn('px-3 py-2 text-xs', textColors.tertiary)}>{r.credential_id || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {athenaRegions.length > 0 && (
                <div className="border border-gray-200 rounded-lg p-3">
                  <AthenaReadonlyTree
                    regions={athenaRegions}
                    loadDatabases={(region, page, size) =>
                      getConfirmedIntegrationAthenaDatabases(targetSourceId, region, page, size)
                    }
                    loadTables={(region, database, page, size) =>
                      getConfirmedIntegrationAthenaTables(targetSourceId, region, database, page, size)
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
