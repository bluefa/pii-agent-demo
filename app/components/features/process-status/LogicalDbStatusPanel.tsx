'use client';

import { useState } from 'react';
import type { Resource, ConnectionStatusResponse, ResourceConnectionStatus, ResourceType } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { getConnectionStatus } from '@/app/lib/api';
import { getResourceTypeLabel } from '@/lib/constants/labels';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { statusColors, textColors, bgColors, borderColors, tableStyles, getButtonClass, cn } from '@/lib/theme';

interface LogicalDbStatusPanelProps {
  targetSourceId: number;
  resources: Resource[];
}

type PanelState = 'idle' | 'loading' | 'success' | 'error';

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
      <span className={statusColors.pending.text}>대기 {totals.pending}</span>
    </span>
  </div>
);

const ResourceTable = ({
  items,
  projectResources,
}: {
  items: ResourceConnectionStatus[];
  projectResources: Resource[];
}) => {
  const findResource = (resourceId: string) =>
    projectResources.find((r) => r.resourceId === resourceId);

  return (
    <div className={cn('border', borderColors.default, 'rounded-lg overflow-hidden', items.length >= 5 && 'max-h-[160px] overflow-auto')}>
      <table className="w-full text-sm">
        <thead className={cn(bgColors.muted, 'text-xs', textColors.tertiary, 'font-medium sticky top-0')}>
          <tr>
            <th className="px-3 py-2 text-left">리소스</th>
            <th className="px-3 py-2 text-left">타입</th>
            <th className="px-3 py-2 text-right">전체</th>
            <th className="px-3 py-2 text-right">성공</th>
            <th className="px-3 py-2 text-right">실패</th>
            <th className="px-3 py-2 text-right">대기</th>
          </tr>
        </thead>
        <tbody className={tableStyles.body}>
          {items.map((item) => {
            const matched = findResource(item.resource_id);
            return (
              <tr key={item.resource_id}>
                <td className={cn('px-3 py-2 truncate max-w-[140px]', textColors.primary)}>
                  {matched?.resourceId ?? item.resource_id}
                </td>
                <td className={cn('px-3 py-2', textColors.tertiary)}>
                  {matched ? getResourceTypeLabel(matched.type as ResourceType) : '-'}
                </td>
                <td className={cn('px-3 py-2 text-right', textColors.secondary)}>{item.total_database_count}</td>
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
  );
};

// --- Main Component ---

export const LogicalDbStatusPanel = ({
  targetSourceId,
  resources,
}: LogicalDbStatusPanelProps) => {
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [data, setData] = useState<ConnectionStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setPanelState('loading');
    setErrorMessage(null);
    try {
      const result = await getConnectionStatus(targetSourceId);
      setData(result);
      setPanelState('success');
    } catch (err) {
      if (err instanceof AppError && err.code === 'CONFIRMED_INTEGRATION_NOT_FOUND') {
        setPanelState('idle');
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

  const title = '리소스에 연결된 데이터베이스';

  return (
    <div className={cn('border', borderColors.default, 'rounded-lg overflow-hidden')}>
      {/* Agent 비정상 경고 */}
      {panelState === 'success' && data && !data.agent_running && (
        <div className={cn('m-3 p-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
          <p className={cn('text-sm', statusColors.warning.textDark)}>
            PII Agent가 정상 동작하지 않고 있습니다. 아래 데이터는 마지막 수집 시점 기준입니다.
          </p>
        </div>
      )}

      <div className="p-4 space-y-3">
        <p className={cn('text-sm font-semibold', textColors.primary)}>{title}</p>

        {/* idle */}
        {panelState === 'idle' && (
          <div className="space-y-3">
            <p className={cn('text-sm', textColors.tertiary)}>
              PII Agent가 각 리소스에서 탐지한 데이터베이스의 연결 상태를 확인할 수 있습니다.
            </p>
            <button onClick={fetchData} className={cn(getButtonClass('primary', 'sm'), 'w-full')}>
              확인하기
            </button>
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
          return (
            <div className="space-y-3">
              <SummaryBar totals={totals} />
              <ProgressBar totals={totals} />
              <p className={cn('text-xs', textColors.quaternary)}>
                조회: {new Date(data.checked_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} (최근 {data.query_period_days}일)
              </p>
              {data.resources.length > 0 && (
                <ResourceTable items={data.resources} projectResources={resources} />
              )}
              <button onClick={fetchData} className={cn(getButtonClass('secondary', 'sm'), 'w-full')}>
                다시 확인하기
              </button>
            </div>
          );
        })()}

        {/* error */}
        {panelState === 'error' && (
          <div className={cn('p-3 rounded-lg flex items-center justify-between', statusColors.error.bg)}>
            <span className={cn('text-sm', statusColors.error.textDark)}>
              {errorMessage}
            </span>
            <button onClick={fetchData} className={getButtonClass('secondary', 'sm')}>
              다시 시도
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
