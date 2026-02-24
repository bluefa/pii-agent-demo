'use client';

import { useState, useEffect } from 'react';
import type { Resource, ConnectionStatusResponse, ResourceConnectionStatus, ResourceType, CloudProvider } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { getConnectionStatus } from '@/app/lib/api';
import { getResourceTypeLabel } from '@/lib/constants/labels';
import { ServiceIcon } from '@/app/components/ui/ServiceIcon';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { statusColors, textColors, bgColors, borderColors, tableStyles, getButtonClass, cn } from '@/lib/theme';

interface LogicalDbStatusPanelProps {
  targetSourceId: number;
  cloudProvider: CloudProvider;
  resources: Resource[];
}

type PanelState = 'loading' | 'success' | 'error';

const PAGE_SIZE = 5;

interface Totals {
  total: number;
  success: number;
  fail: number;
  pending: number;
}

const sumTotals = (items: ResourceConnectionStatus[]): Totals =>
  items.reduce(
    (acc, r) => ({
      total: acc.total + r.total_database_count,
      success: acc.success + r.success_database_count,
      fail: acc.fail + r.fail_count,
      pending: acc.pending + r.pending_count,
    }),
    { total: 0, success: 0, fail: 0, pending: 0 },
  );

// --- Sub-components ---

const ProgressBar = ({ totals }: { totals: Totals }) => {
  if (totals.total === 0) return null;
  const pct = (n: number) => `${(n / totals.total) * 100}%`;
  return (
    <div className={cn(statusColors.pending.bg, 'rounded-full h-2 overflow-hidden flex')}>
      {totals.success > 0 && (
        <div className={statusColors.success.dot} style={{ width: pct(totals.success) }} />
      )}
      {totals.fail > 0 && (
        <div className={statusColors.error.dot} style={{ width: pct(totals.fail) }} />
      )}
      {totals.pending > 0 && (
        <div className={statusColors.pending.dot} style={{ width: pct(totals.pending) }} />
      )}
    </div>
  );
};

const SummaryBar = ({ totals }: { totals: Totals }) => (
  <div className="flex items-center gap-3 text-sm">
    <span className={cn(textColors.secondary, 'font-medium')}>전체 {totals.total}</span>
    <span className="flex items-center gap-1">
      <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.success.dot)} />
      <span className={statusColors.success.text}>성공 {totals.success}</span>
    </span>
    <span className="flex items-center gap-1">
      <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.error.dot)} />
      <span className={statusColors.error.text}>실패 {totals.fail}</span>
    </span>
    <span className="flex items-center gap-1">
      <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.pending.dot)} />
      <span className={statusColors.pending.text}>연결대기중 {totals.pending}</span>
    </span>
  </div>
);

const ResourceTable = ({
  items,
  projectResources,
  cloudProvider,
  page,
  onPageChange,
}: {
  items: ResourceConnectionStatus[];
  projectResources: Resource[];
  cloudProvider: CloudProvider;
  page: number;
  onPageChange: (page: number) => void;
}) => {
  const findResource = (resourceId: string) =>
    projectResources.find((r) => r.resourceId === resourceId);

  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className={cn('border', borderColors.default, 'rounded-lg overflow-hidden')}>
        <table className="w-full text-sm">
          <thead className={cn(bgColors.muted, 'text-xs', textColors.tertiary, 'font-medium')}>
            <tr>
              <th className="px-3 py-2 text-left">리소스</th>
              <th className="px-3 py-2 text-right">성공</th>
              <th className="px-3 py-2 text-right">실패</th>
              <th className="px-3 py-2 text-right">대기</th>
            </tr>
          </thead>
          <tbody className={tableStyles.body}>
            {pageItems.map((item) => {
              const matched = findResource(item.resource_id);
              const resourceType = matched?.type as ResourceType | undefined;
              return (
                <tr key={item.resource_id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {resourceType && (
                        <ServiceIcon provider={cloudProvider} resourceType={resourceType} size="sm" />
                      )}
                      <span className={cn('font-medium text-sm', textColors.primary)}>
                        {resourceType ? getResourceTypeLabel(resourceType) : '-'}
                      </span>
                      <span className={cn('font-mono text-xs truncate', textColors.tertiary)}>
                        {item.resource_id}
                      </span>
                    </div>
                  </td>
                  <td className={cn('px-3 py-2 text-right', textColors.secondary)}>{item.success_database_count}</td>
                  <td className={cn('px-3 py-2 text-right', item.fail_count > 0 ? `${statusColors.error.text} font-medium` : textColors.quaternary)}>
                    {item.fail_count}
                  </td>
                  <td className={cn('px-3 py-2 text-right', item.pending_count > 0 ? `${statusColors.pending.text} font-medium` : textColors.quaternary)}>
                    {item.pending_count}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className={getButtonClass('ghost', 'sm')}
          >
            이전
          </button>
          <span className={cn('text-xs', textColors.tertiary)}>{page + 1} / {totalPages}</span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className={getButtonClass('ghost', 'sm')}
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

export const LogicalDbStatusPanel = ({
  targetSourceId,
  cloudProvider,
  resources,
}: LogicalDbStatusPanelProps) => {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [data, setData] = useState<ConnectionStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const fetchData = async (signal?: { cancelled: boolean }) => {
    setPanelState('loading');
    setErrorMessage(null);
    try {
      const result = await getConnectionStatus(targetSourceId);
      if (signal?.cancelled) return;
      setData(result);
      setPanelState('success');
    } catch (err) {
      if (signal?.cancelled) return;
      if (err instanceof AppError && err.code === 'CONFIRMED_INTEGRATION_NOT_FOUND') {
        setData({ resources: [], checked_at: new Date().toISOString(), query_period_days: 0, agent_running: true });
        setPanelState('success');
        return;
      }
      setErrorMessage(
        err instanceof AppError && err.isUserFacing
          ? err.message
          : '연결 상태를 불러오지 못했습니다.',
      );
      setPanelState('error');
    }
  };

  useEffect(() => {
    const signal = { cancelled: false };
    fetchData(signal);
    return () => { signal.cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetSourceId]);

  return (
    <div className={cn(bgColors.muted, 'border', borderColors.default, 'rounded-lg p-4 space-y-3')}>
      {/* 헤더 */}
      <h4 className={cn('text-sm font-semibold', textColors.primary)}>리소스에 연결된 데이터베이스</h4>

      {/* 가이드 */}
      <p className={cn('text-sm', textColors.tertiary)}>
        각 리소스의 데이터베이스 수와 PII Agent 연동 성공/실패/대기 현황을 보여줍니다.
      </p>

      {/* Agent 비정상 경고 */}
      {panelState === 'success' && data && !data.agent_running && (
        <div className={cn('p-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
          <p className={cn('text-sm', statusColors.warning.textDark)}>
            PII Agent가 정상 동작하지 않고 있습니다. 아래 데이터는 마지막 수집 시점 기준입니다.
          </p>
        </div>
      )}

      {/* loading */}
      {panelState === 'loading' && (
        <div className={cn('flex items-center justify-center gap-2 py-6 text-sm', textColors.tertiary)}>
          <LoadingSpinner />
          연결 상태 조회 중...
        </div>
      )}

      {/* success */}
      {panelState === 'success' && data && (() => {
        const totals = sumTotals(data.resources);
        if (data.resources.length === 0) {
          return (
            <p className={cn('text-sm py-4 text-center', textColors.quaternary)}>
              연결된 데이터베이스가 없습니다.
            </p>
          );
        }
        return (
          <div className="space-y-3">
            <SummaryBar totals={totals} />
            <ProgressBar totals={totals} />
            <p className={cn('text-xs', textColors.quaternary)}>
              조회: {new Date(data.checked_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (최근 {data.query_period_days}일)
            </p>
            <ResourceTable
              items={data.resources}
              projectResources={resources}
              cloudProvider={cloudProvider}
              page={page}
              onPageChange={setPage}
            />
          </div>
        );
      })()}

      {/* error */}
      {panelState === 'error' && (
        <div className={cn('p-3 rounded-lg flex items-center justify-between', statusColors.error.bg)}>
          <span className={cn('text-sm', statusColors.error.textDark)}>
            {errorMessage}
          </span>
          <button
            onClick={() => fetchData()}
            className={getButtonClass('secondary', 'sm')}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
};
