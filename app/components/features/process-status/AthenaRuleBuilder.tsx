'use client';

import { useMemo, useState } from 'react';
import {
  type AthenaDatabaseNode,
  type AthenaDatabasePageResponse,
  type AthenaSelectionRule,
  type AthenaTableNode,
  type AthenaTablePageResponse,
  getAthenaDatabaseTables,
  getAthenaRegionDatabases,
} from '@/app/lib/api';
import { Button } from '@/app/components/ui/Button';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { cn, statusColors, tableStyles, textColors } from '@/lib/theme';

interface AthenaRegionCandidate {
  resource_id: string;
  athena_region: string;
  total_table_count: number;
}

interface AthenaRuleBuilderProps {
  targetSourceId: number;
  regions: AthenaRegionCandidate[];
  rules: AthenaSelectionRule[];
  onChange: (rules: AthenaSelectionRule[]) => void;
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

type DatabaseDetailTab = 'overview' | 'tables';

const DEFAULT_PAGE_SIZE = 20;

const tableKey = (region: string, database: string): string => `${region}::${database}`;

const upsertRule = (rules: AthenaSelectionRule[], rule: AthenaSelectionRule): AthenaSelectionRule[] => {
  const next = [...rules];
  const index = next.findIndex((item) => item.resource_id === rule.resource_id && item.scope === rule.scope);
  if (index >= 0) {
    next[index] = rule;
    return next;
  }
  next.push(rule);
  return next;
};

const getRule = (
  rules: AthenaSelectionRule[],
  scope: AthenaSelectionRule['scope'],
  resourceId: string,
): AthenaSelectionRule | undefined =>
  rules.find((rule) => rule.scope === scope && rule.resource_id === resourceId);

const buildDatabaseRule = (
  rules: AthenaSelectionRule[],
  resourceId: string,
  selected: boolean,
): AthenaSelectionRule => {
  const prev = getRule(rules, 'DATABASE', resourceId);
  return {
    scope: 'DATABASE',
    resource_id: resourceId,
    selected,
    include_all_tables: selected ? (prev?.include_all_tables ?? false) : undefined,
  };
};

const buildRegionRule = (
  rules: AthenaSelectionRule[],
  resourceId: string,
  selected: boolean,
): AthenaSelectionRule => {
  const prev = getRule(rules, 'REGION', resourceId);
  return {
    scope: 'REGION',
    resource_id: resourceId,
    selected,
    include_all_tables: selected ? (prev?.include_all_tables ?? false) : undefined,
  };
};

const buildIncludeAllRule = (
  rules: AthenaSelectionRule[],
  scope: 'REGION' | 'DATABASE',
  resourceId: string,
  checked: boolean,
): AthenaSelectionRule => {
  const prev = getRule(rules, scope, resourceId);
  return {
    scope,
    resource_id: resourceId,
    selected: prev?.selected ?? true,
    include_all_tables: checked,
  };
};

const getRegionSelectedTableCount = (
  region: AthenaRegionCandidate,
  rules: AthenaSelectionRule[],
): number => {
  const regionRule = getRule(rules, 'REGION', region.resource_id);
  if (regionRule?.selected && regionRule.include_all_tables) {
    return region.total_table_count;
  }
  let count = 0;
  for (const rule of rules) {
    if (rule.scope !== 'TABLE' || !rule.selected) continue;
    if (!rule.resource_id.startsWith(`${region.resource_id}/`)) continue;
    count += 1;
  }
  return count;
};

const isDatabaseEffectivelySelected = (
  rules: AthenaSelectionRule[],
  regionResourceId: string,
  databaseResourceId: string,
): boolean => {
  const databaseRule = getRule(rules, 'DATABASE', databaseResourceId);
  if (databaseRule) return databaseRule.selected;

  const regionRule = getRule(rules, 'REGION', regionResourceId);
  return regionRule?.selected === true && regionRule.include_all_tables === true;
};

const isTableEffectivelySelected = (
  rules: AthenaSelectionRule[],
  regionResourceId: string,
  databaseResourceId: string,
  tableResourceId: string,
): boolean => {
  const tableRule = getRule(rules, 'TABLE', tableResourceId);
  if (tableRule) return tableRule.selected;

  const databaseRule = getRule(rules, 'DATABASE', databaseResourceId);
  if (databaseRule?.selected === true && databaseRule.include_all_tables === true) return true;

  const regionRule = getRule(rules, 'REGION', regionResourceId);
  return regionRule?.selected === true && regionRule.include_all_tables === true;
};

export const AthenaRuleBuilder = ({
  targetSourceId,
  regions,
  rules,
  onChange,
}: AthenaRuleBuilderProps) => {
  const [expandedRegions, setExpandedRegions] = useState<Record<string, boolean>>({});
  const [databaseStates, setDatabaseStates] = useState<Record<string, AthenaDatabaseState>>({});
  const [tableStates, setTableStates] = useState<Record<string, AthenaTableState>>({});
  const [activeDatabaseByRegion, setActiveDatabaseByRegion] = useState<Record<string, string>>({});
  const [activeTabByRegion, setActiveTabByRegion] = useState<Record<string, DatabaseDetailTab>>({});

  const sortedRegions = useMemo(
    () => [...regions].sort((a, b) => a.athena_region.localeCompare(b.athena_region)),
    [regions],
  );

  const setRegionExpanded = async (region: AthenaRegionCandidate, expanded: boolean) => {
    setExpandedRegions((prev) => ({ ...prev, [region.athena_region]: expanded }));
    if (!expanded) return;

    const current = databaseStates[region.athena_region];
    if (current?.data || current?.loading) return;

    setDatabaseStates((prev) => ({
      ...prev,
      [region.athena_region]: {
        loading: true,
        page: 0,
        size: DEFAULT_PAGE_SIZE,
        data: null,
        error: null,
      },
    }));
    try {
      const data = await getAthenaRegionDatabases(targetSourceId, region.athena_region, 0, DEFAULT_PAGE_SIZE);
      setDatabaseStates((prev) => ({
        ...prev,
        [region.athena_region]: { loading: false, page: 0, size: DEFAULT_PAGE_SIZE, data, error: null },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database 목록을 불러오지 못했습니다.';
      setDatabaseStates((prev) => ({
        ...prev,
        [region.athena_region]: {
          loading: false,
          page: 0,
          size: DEFAULT_PAGE_SIZE,
          data: prev[region.athena_region]?.data ?? null,
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
      const data = await getAthenaRegionDatabases(targetSourceId, region, page, size);
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

  const ensureTableLoaded = async (region: string, database: string) => {
    const key = tableKey(region, database);
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
      const data = await getAthenaDatabaseTables(targetSourceId, region, database, 0, DEFAULT_PAGE_SIZE);
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
      const data = await getAthenaDatabaseTables(targetSourceId, region, database, page, size);
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

  const onRegionSelectChange = (regionResourceId: string, selected: boolean) => {
    onChange(upsertRule(rules, buildRegionRule(rules, regionResourceId, selected)));
  };

  const onDatabaseSelectChange = (databaseResourceId: string, selected: boolean) => {
    onChange(upsertRule(rules, buildDatabaseRule(rules, databaseResourceId, selected)));
  };

  const onTableSelectChange = (tableResourceId: string, selected: boolean) => {
    onChange(
      upsertRule(rules, {
        scope: 'TABLE',
        resource_id: tableResourceId,
        selected,
      }),
    );
  };

  const onIncludeAllChange = (
    scope: 'REGION' | 'DATABASE',
    resourceId: string,
    checked: boolean,
  ) => {
    onChange(upsertRule(rules, buildIncludeAllRule(rules, scope, resourceId, checked)));
  };

  const onRegionCheckboxChange = async (
    region: AthenaRegionCandidate,
    selected: boolean,
  ) => {
    onRegionSelectChange(region.resource_id, selected);
    if (selected) {
      await setRegionExpanded(region, true);
    }
  };

  const onDatabaseOpen = async (
    region: string,
    database: string,
    tab: DatabaseDetailTab = 'tables',
  ) => {
    setActiveDatabaseByRegion((prev) => ({ ...prev, [region]: database }));
    setActiveTabByRegion((prev) => ({ ...prev, [region]: tab }));
    if (tab === 'tables') {
      await ensureTableLoaded(region, database);
    }
  };

  const renderTableRows = (
    region: string,
    database: string,
    regionResourceId: string,
    databaseResourceId: string,
    tables: AthenaTableNode[],
  ) =>
    tables.map((table) => {
      const selected = isTableEffectivelySelected(
        rules,
        regionResourceId,
        databaseResourceId,
        table.resource_id,
      );
      return (
        <tr key={table.resource_id} className={tableStyles.row}>
          <td className={cn(tableStyles.cell, 'pl-16')}>
            <input
              type="checkbox"
              checked={selected}
              onChange={(event) => onTableSelectChange(table.resource_id, event.target.checked)}
            />
          </td>
          <td className={cn(tableStyles.cell, 'font-mono text-xs', textColors.tertiary)}>{table.resource_id}</td>
          <td className={cn(tableStyles.cell, textColors.secondary)}>{table.table}</td>
          <td className={cn(tableStyles.cell, textColors.tertiary)}>{database}</td>
          <td className={cn(tableStyles.cell, textColors.tertiary)}>{region}</td>
        </tr>
      );
    });

  return (
    <div className="space-y-3">
      {sortedRegions.map((region) => {
        const regionRule = getRule(rules, 'REGION', region.resource_id);
        const regionSelected = regionRule?.selected === true;
        const regionIncludeAll = regionRule?.include_all_tables === true;
        const dbState = databaseStates[region.athena_region];
        const selectedTableCount = getRegionSelectedTableCount(region, rules);

        return (
          <div key={region.resource_id} className={cn('border rounded-lg', statusColors.pending.border)}>
            <div className="px-4 py-3 flex items-center gap-3">
              <input
                type="checkbox"
                checked={regionSelected}
                onChange={(event) => {
                  void onRegionCheckboxChange(region, event.target.checked);
                }}
              />
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', textColors.primary)}>{region.resource_id}</p>
                <p className={cn('text-xs', textColors.tertiary)}>
                  선택 {selectedTableCount} / 전체 {region.total_table_count}
                </p>
              </div>
              <Button
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => setRegionExpanded(region, !expandedRegions[region.athena_region])}
              >
                {expandedRegions[region.athena_region] ? '닫기' : 'Database 보기'}
              </Button>
            </div>

            {regionSelected && (
              <div className={cn('px-4 pb-3', textColors.secondary)}>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={regionIncludeAll}
                    onChange={(event) => onIncludeAllChange('REGION', region.resource_id, event.target.checked)}
                  />
                  <span>이 Region의 모든 Database 선택</span>
                </label>
              </div>
            )}

            {expandedRegions[region.athena_region] && (
              <div className={cn('border-t', statusColors.pending.border)}>
                {dbState?.loading && (
                  <div className="px-4 py-4 flex items-center gap-2 text-sm">
                    <LoadingSpinner size="sm" />
                    <span className={textColors.tertiary}>Database 목록 조회 중...</span>
                  </div>
                )}

                {!dbState?.loading && dbState?.error && (
                  <div className={cn('px-4 py-3 text-sm', statusColors.error.textDark)}>{dbState.error}</div>
                )}

                {!dbState?.loading && dbState?.data && (
                  <div className="space-y-3 p-4">
                    {dbState.data.content.length === 0 ? (
                      <p className={cn('text-sm', textColors.tertiary)}>Database가 없습니다.</p>
                    ) : (
                      <>
                        <div className={cn('border rounded-lg', statusColors.pending.border, 'overflow-hidden')}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className={tableStyles.header}>
                                <th className={tableStyles.headerCell}>선택</th>
                                <th className={tableStyles.headerCell}>Database</th>
                                <th className={tableStyles.headerCell}>Resource ID</th>
                              </tr>
                            </thead>
                            <tbody className={tableStyles.body}>
                              {dbState.data.content.map((database: AthenaDatabaseNode) => {
                                const databaseSelected = isDatabaseEffectivelySelected(
                                  rules,
                                  region.resource_id,
                                  database.resource_id,
                                );
                                const isActive = activeDatabaseByRegion[region.athena_region] === database.database;

                                return (
                                  <tr
                                    key={database.resource_id}
                                    className={cn(tableStyles.row, 'cursor-pointer', isActive && statusColors.info.bg)}
                                    onClick={() => {
                                      void onDatabaseOpen(region.athena_region, database.database, 'tables');
                                    }}
                                  >
                                    <td className={tableStyles.cell} onClick={(event) => event.stopPropagation()}>
                                      <input
                                        type="checkbox"
                                        checked={databaseSelected}
                                        onChange={(event) => onDatabaseSelectChange(database.resource_id, event.target.checked)}
                                      />
                                    </td>
                                    <td className={cn(tableStyles.cell, textColors.secondary)}>{database.database}</td>
                                    <td className={cn(tableStyles.cell, 'font-mono text-xs', textColors.tertiary)}>
                                      {database.resource_id}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {dbState.data.page.totalPages > 1 && (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={dbState.data.page.number <= 0}
                              onClick={() => loadDatabasePage(
                                region.athena_region,
                                Math.max(0, dbState.data!.page.number - 1),
                                dbState.data!.page.size,
                              )}
                            >
                              이전
                            </Button>
                            <span className={cn('text-xs', textColors.tertiary)}>
                              {dbState.data.page.number + 1} / {dbState.data.page.totalPages}
                            </span>
                            <Button
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              disabled={dbState.data.page.number + 1 >= dbState.data.page.totalPages}
                              onClick={() => loadDatabasePage(
                                region.athena_region,
                                dbState.data!.page.number + 1,
                                dbState.data!.page.size,
                              )}
                            >
                              다음
                            </Button>
                          </div>
                        )}

                        {activeDatabaseByRegion[region.athena_region] && (() => {
                          const activeDatabase = activeDatabaseByRegion[region.athena_region];
                          const activeDatabaseNode = dbState.data!.content.find(
                            (database) => database.database === activeDatabase,
                          );
                          if (!activeDatabaseNode) return null;

                          const activeKey = tableKey(region.athena_region, activeDatabaseNode.database);
                          const tableState = tableStates[activeKey];
                          const databaseRule = getRule(rules, 'DATABASE', activeDatabaseNode.resource_id);
                          const databaseSelected = isDatabaseEffectivelySelected(
                            rules,
                            region.resource_id,
                            activeDatabaseNode.resource_id,
                          );
                          const databaseIncludeAll = databaseRule?.include_all_tables === true;
                          const activeTab = activeTabByRegion[region.athena_region] ?? 'tables';

                          return (
                            <div className={cn('border rounded-lg', statusColors.pending.border)}>
                              <div className={cn('px-4 py-3 border-b', statusColors.pending.border)}>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className={cn('text-sm font-medium', textColors.primary)}>
                                      Database 상세: {activeDatabaseNode.database}
                                    </p>
                                    <p className={cn('text-xs font-mono', textColors.tertiary)}>
                                      {activeDatabaseNode.resource_id}
                                    </p>
                                  </div>
                                  <div className={cn('inline-flex rounded-md border', statusColors.pending.border)}>
                                    <button
                                      type="button"
                                      className={cn(
                                        'px-3 py-1.5 text-xs',
                                        activeTab === 'overview'
                                          ? cn(statusColors.info.bg, statusColors.info.textDark)
                                          : textColors.secondary,
                                      )}
                                      onClick={() => setActiveTabByRegion((prev) => ({
                                        ...prev,
                                        [region.athena_region]: 'overview',
                                      }))}
                                    >
                                      개요
                                    </button>
                                    <button
                                      type="button"
                                      className={cn(
                                        'px-3 py-1.5 text-xs border-l',
                                        statusColors.pending.border,
                                        activeTab === 'tables'
                                          ? cn(statusColors.info.bg, statusColors.info.textDark)
                                          : textColors.secondary,
                                      )}
                                      onClick={() => {
                                        void onDatabaseOpen(
                                          region.athena_region,
                                          activeDatabaseNode.database,
                                          'tables',
                                        );
                                      }}
                                    >
                                      Table 선택
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {activeTab === 'overview' ? (
                                <div className={cn('p-4 space-y-3', textColors.secondary)}>
                                  <label className="inline-flex items-center gap-2 text-sm">
                                    <input
                                      type="checkbox"
                                      checked={databaseSelected}
                                      onChange={(event) => onDatabaseSelectChange(
                                        activeDatabaseNode.resource_id,
                                        event.target.checked,
                                      )}
                                    />
                                    <span>이 Database 선택</span>
                                  </label>
                                  {databaseSelected && (
                                    <label className="inline-flex items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={databaseIncludeAll}
                                        onChange={(event) => onIncludeAllChange(
                                          'DATABASE',
                                          activeDatabaseNode.resource_id,
                                          event.target.checked,
                                        )}
                                      />
                                      <span>이 Database의 모든 Table 선택</span>
                                    </label>
                                  )}
                                </div>
                              ) : (
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
                                            <th className={tableStyles.headerCell}>Database</th>
                                            <th className={tableStyles.headerCell}>Region</th>
                                          </tr>
                                        </thead>
                                        <tbody className={tableStyles.body}>
                                          {renderTableRows(
                                            region.athena_region,
                                            activeDatabaseNode.database,
                                            region.resource_id,
                                            activeDatabaseNode.resource_id,
                                            tableState.data.content,
                                          )}
                                        </tbody>
                                      </table>
                                      <div className="px-4 pt-3 flex items-center justify-end gap-2">
                                        <Button
                                          variant="secondary"
                                          className="px-2 py-1 text-xs"
                                          disabled={tableState.data.page.number <= 0}
                                          onClick={() => loadTablePage(
                                            region.athena_region,
                                            activeDatabaseNode.database,
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
                                            region.athena_region,
                                            activeDatabaseNode.database,
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
                        })()}
                      </>
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
