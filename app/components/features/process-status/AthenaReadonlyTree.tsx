'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import type {
  AthenaDatabasePageResponse,
  AthenaRegionResourceSummary,
  AthenaTablePageResponse,
} from '@/app/lib/api';
import { cn, statusColors, tableStyles, textColors } from '@/lib/theme';

interface AthenaReadonlyTreeProps {
  regions: AthenaRegionResourceSummary[];
  loadDatabases: (region: string, page: number, size: number) => Promise<AthenaDatabasePageResponse>;
  loadTables: (
    region: string,
    database: string,
    page: number,
    size: number,
  ) => Promise<AthenaTablePageResponse>;
  emptyMessage?: string;
}

interface AthenaDatabaseState {
  loading: boolean;
  page: number;
  size: number;
  data: AthenaDatabasePageResponse | null;
  error: string | null;
}

interface AthenaTableState {
  loading: boolean;
  page: number;
  size: number;
  data: AthenaTablePageResponse | null;
  error: string | null;
}

const DEFAULT_PAGE_SIZE = 20;
const tableKey = (region: string, database: string): string => `${region}::${database}`;

export const AthenaReadonlyTree = ({
  regions,
  loadDatabases,
  loadTables,
  emptyMessage = '선택된 Athena 리소스가 없습니다.',
}: AthenaReadonlyTreeProps) => {
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});
  const [expandedDatabases, setExpandedDatabases] = useState<Record<string, boolean>>({});
  const [databaseStates, setDatabaseStates] = useState<Record<string, AthenaDatabaseState>>({});
  const [tableStates, setTableStates] = useState<Record<string, AthenaTableState>>({});

  const setRegionExpanded = async (region: string, expanded: boolean) => {
    setExpandedRegions((prev) => ({ ...prev, [region]: expanded }));
    if (!expanded) return;

    const current = databaseStates[region];
    if (current?.data || current?.loading) return;

    setDatabaseStates((prev) => ({
      ...prev,
      [region]: {
        loading: true,
        page: 0,
        size: DEFAULT_PAGE_SIZE,
        data: null,
        error: null,
      },
    }));

    try {
      const data = await loadDatabases(region, 0, DEFAULT_PAGE_SIZE);
      setDatabaseStates((prev) => ({
        ...prev,
        [region]: { loading: false, page: 0, size: DEFAULT_PAGE_SIZE, data, error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database 목록을 불러오지 못했습니다.';
      setDatabaseStates((prev) => ({
        ...prev,
        [region]: {
          loading: false,
          page: 0,
          size: DEFAULT_PAGE_SIZE,
          data: prev[region]?.data ?? null,
          error: message,
        },
      }));
    }
  };

  const loadDatabasePage = async (region: string, page: number, size: number) => {
    const prevState = databaseStates[region];
    setDatabaseStates((prev) => ({
      ...prev,
      [region]: {
        loading: true,
        page,
        size,
        data: prevState?.data ?? null,
        error: null,
      },
    }));
    try {
      const data = await loadDatabases(region, page, size);
      setDatabaseStates((prev) => ({
        ...prev,
        [region]: { loading: false, page, size, data, error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database 목록을 불러오지 못했습니다.';
      setDatabaseStates((prev) => ({
        ...prev,
        [region]: {
          loading: false,
          page,
          size,
          data: prev[region]?.data ?? null,
          error: message,
        },
      }));
    }
  };

  const setDatabaseExpanded = async (region: string, database: string, expanded: boolean) => {
    const key = tableKey(region, database);
    setExpandedDatabases((prev) => ({ ...prev, [key]: expanded }));
    if (!expanded) return;

    const current = tableStates[key];
    if (current?.data || current?.loading) return;

    setTableStates((prev) => ({
      ...prev,
      [key]: {
        loading: true,
        page: 0,
        size: DEFAULT_PAGE_SIZE,
        data: null,
        error: null,
      },
    }));

    try {
      const data = await loadTables(region, database, 0, DEFAULT_PAGE_SIZE);
      setTableStates((prev) => ({
        ...prev,
        [key]: { loading: false, page: 0, size: DEFAULT_PAGE_SIZE, data, error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Table 목록을 불러오지 못했습니다.';
      setTableStates((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          page: 0,
          size: DEFAULT_PAGE_SIZE,
          data: prev[key]?.data ?? null,
          error: message,
        },
      }));
    }
  };

  const loadTablePage = async (region: string, database: string, page: number, size: number) => {
    const key = tableKey(region, database);
    const prevState = tableStates[key];
    setTableStates((prev) => ({
      ...prev,
      [key]: {
        loading: true,
        page,
        size,
        data: prevState?.data ?? null,
        error: null,
      },
    }));
    try {
      const data = await loadTables(region, database, page, size);
      setTableStates((prev) => ({
        ...prev,
        [key]: { loading: false, page, size, data, error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Table 목록을 불러오지 못했습니다.';
      setTableStates((prev) => ({
        ...prev,
        [key]: {
          loading: false,
          page,
          size,
          data: prev[key]?.data ?? null,
          error: message,
        },
      }));
    }
  };

  if (regions.length === 0) {
    return <p className={cn('text-sm', textColors.tertiary)}>{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {regions.map((regionSummary) => {
        const databaseState = databaseStates[regionSummary.athena_region];

        return (
          <div key={regionSummary.resource_id} className={cn('border rounded-lg', statusColors.pending.border)}>
            <div className="px-4 py-3 flex items-center gap-3">
              <span className={cn('text-sm', textColors.secondary)}>[x]</span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', textColors.primary)}>{regionSummary.resource_id}</p>
                <p className={cn('text-xs', textColors.tertiary)}>
                  selected_table_count: {regionSummary.selected_table_count ?? 0}
                </p>
              </div>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => setRegionExpanded(regionSummary.athena_region, !expandedRegions[regionSummary.athena_region])}
              >
                {expandedRegions[regionSummary.athena_region] ? '닫기' : 'Database 보기'}
              </Button>
            </div>

            {expandedRegions[regionSummary.athena_region] && (
              <div className={cn('border-t', statusColors.pending.border)}>
                {databaseState?.loading && (
                  <div className="px-4 py-4 flex items-center gap-2 text-sm">
                    <LoadingSpinner size="sm" />
                    <span className={textColors.tertiary}>Database 목록 조회 중...</span>
                  </div>
                )}
                {!databaseState?.loading && databaseState?.error && (
                  <div className={cn('px-4 py-3 text-sm', statusColors.error.textDark)}>{databaseState.error}</div>
                )}
                {!databaseState?.loading && databaseState?.data && (
                  <div className="space-y-3 p-4">
                    {databaseState.data.content.length === 0 ? (
                      <p className={cn('text-sm', textColors.tertiary)}>선택된 Database가 없습니다.</p>
                    ) : (
                      databaseState.data.content.map((database) => {
                        const key = tableKey(regionSummary.athena_region, database.database);
                        const tableState = tableStates[key];
                        return (
                          <div key={database.resource_id} className={cn('border rounded-lg', statusColors.pending.border)}>
                            <div className="px-4 py-3 flex items-center gap-3">
                              <span className={cn('text-sm', textColors.secondary)}>[x]</span>
                              <div className="min-w-0 flex-1">
                                <p className={cn('text-sm font-medium', textColors.primary)}>{database.database}</p>
                                <p className={cn('text-xs font-mono', textColors.tertiary)}>{database.resource_id}</p>
                              </div>
                              <Button
                                variant="secondary"
                                className="px-2 py-1 text-xs"
                                onClick={() => setDatabaseExpanded(
                                  regionSummary.athena_region,
                                  database.database,
                                  !expandedDatabases[key],
                                )}
                              >
                                {expandedDatabases[key] ? '닫기' : 'Table 보기'}
                              </Button>
                            </div>

                            {expandedDatabases[key] && (
                              <div className={cn('border-t', statusColors.pending.border)}>
                                {tableState?.loading && (
                                  <div className="px-4 py-4 flex items-center gap-2 text-sm">
                                    <LoadingSpinner size="sm" />
                                    <span className={textColors.tertiary}>Table 목록 조회 중...</span>
                                  </div>
                                )}
                                {!tableState?.loading && tableState?.error && (
                                  <div className={cn('px-4 py-3 text-sm', statusColors.error.textDark)}>{tableState.error}</div>
                                )}
                                {!tableState?.loading && tableState?.data && (
                                  <div className="pb-3">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className={tableStyles.header}>
                                          <th className={tableStyles.headerCell}>선택</th>
                                          <th className={tableStyles.headerCell}>Table Resource ID</th>
                                          <th className={tableStyles.headerCell}>Table</th>
                                        </tr>
                                      </thead>
                                      <tbody className={tableStyles.body}>
                                        {tableState.data.content.map((table) => (
                                          <tr key={table.resource_id} className={tableStyles.row}>
                                            <td className={cn(tableStyles.cell, 'pl-12')}>
                                              <span className={cn('text-sm', textColors.secondary)}>[x]</span>
                                            </td>
                                            <td className={cn(tableStyles.cell, 'font-mono text-xs', textColors.tertiary)}>
                                              {table.resource_id}
                                            </td>
                                            <td className={cn(tableStyles.cell, textColors.secondary)}>{table.table}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    <div className="px-4 pt-3 flex items-center justify-end gap-2">
                                      <Button
                                        variant="secondary"
                                        className="px-2 py-1 text-xs"
                                        disabled={tableState.data.page.number <= 0}
                                        onClick={() => loadTablePage(
                                          regionSummary.athena_region,
                                          database.database,
                                          Math.max(0, tableState.data!.page.number - 1),
                                          tableState.data!.page.size,
                                        )}
                                      >
                                        이전
                                      </Button>
                                      <span className={cn('text-xs', textColors.tertiary)}>
                                        {tableState.data.page.number + 1} / {tableState.data.page.totalPages}
                                      </span>
                                      <Button
                                        variant="secondary"
                                        className="px-2 py-1 text-xs"
                                        disabled={tableState.data.page.number + 1 >= tableState.data.page.totalPages}
                                        onClick={() => loadTablePage(
                                          regionSummary.athena_region,
                                          database.database,
                                          tableState.data!.page.number + 1,
                                          tableState.data!.page.size,
                                        )}
                                      >
                                        다음
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}

                    {databaseState.data.page.totalPages > 1 && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={databaseState.data.page.number <= 0}
                          onClick={() => loadDatabasePage(
                            regionSummary.athena_region,
                            Math.max(0, databaseState.data!.page.number - 1),
                            databaseState.data!.page.size,
                          )}
                        >
                          이전
                        </Button>
                        <span className={cn('text-xs', textColors.tertiary)}>
                          {databaseState.data.page.number + 1} / {databaseState.data.page.totalPages}
                        </span>
                        <Button
                          variant="secondary"
                          className="px-2 py-1 text-xs"
                          disabled={databaseState.data.page.number + 1 >= databaseState.data.page.totalPages}
                          onClick={() => loadDatabasePage(
                            regionSummary.athena_region,
                            databaseState.data!.page.number + 1,
                            databaseState.data!.page.size,
                          )}
                        >
                          다음
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
