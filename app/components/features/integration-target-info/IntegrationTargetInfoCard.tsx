'use client';

import { useEffect, useState } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { bgColors, cardStyles, cn, getButtonClass, statusColors, tableStyles, textColors } from '@/lib/theme';

interface IntegrationTargetInfoCardProps {
  targetSourceId: number;
}

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; resources: ConfirmedIntegrationResourceItem[] };

export const IntegrationTargetInfoCard = ({ targetSourceId }: IntegrationTargetInfoCardProps) => {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void getConfirmedIntegration(targetSourceId)
      .then((response) => {
        if (cancelled) return;
        setState({ status: 'ready', resources: response.resource_infos });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isMissingConfirmedIntegrationError(error)) {
          setState({ status: 'ready', resources: [] });
          return;
        }
        const message = error instanceof Error
          ? error.message
          : '연동 대상 정보를 불러오지 못했습니다.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [targetSourceId, retryNonce]);

  const handleRetry = () => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  };

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className="px-6 py-4 border-b border-gray-100">
        <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>
          연동 대상 정보
        </h2>
        <p className={cn('mt-1 text-xs', textColors.tertiary)}>
          관리자 확정된 연동 대상 DB 목록입니다.
        </p>
      </header>
      <div className="px-0 py-0">
        <IntegrationTargetInfoBody state={state} onRetry={handleRetry} />
      </div>
    </section>
  );
};

interface IntegrationTargetInfoBodyProps {
  state: FetchState;
  onRetry: () => void;
}

const IntegrationTargetInfoBody = ({ state, onRetry }: IntegrationTargetInfoBodyProps) => {
  if (state.status === 'loading') {
    return (
      <div className="px-6 py-12 flex items-center justify-center gap-3">
        <LoadingSpinner />
        <span className={cn('text-sm', textColors.tertiary)}>불러오는 중...</span>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className={cn('px-6 py-6 space-y-3', statusColors.error.bg)}>
        <p className={cn('text-sm font-medium', statusColors.error.textDark)}>
          {state.message}
        </p>
        <button onClick={onRetry} className={getButtonClass('secondary', 'sm')}>
          다시 시도
        </button>
      </div>
    );
  }
  if (state.resources.length === 0) {
    return (
      <div className={cn('px-6 py-12 text-sm text-center', textColors.tertiary)}>
        확정된 연동 대상 DB 가 없습니다.
      </div>
    );
  }
  return (
    <table className="w-full text-sm">
      <thead className={bgColors.muted}>
        <tr>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            리소스 ID
          </th>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            유형
          </th>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            DB 타입
          </th>
          <th className={cn(tableStyles.headerCell, 'text-left text-xs font-medium', textColors.tertiary)}>
            Credential
          </th>
        </tr>
      </thead>
      <tbody className={tableStyles.body}>
        {state.resources.map((resource) => (
          <tr key={resource.resource_id} className={tableStyles.row}>
            <td className={cn(tableStyles.cell, 'font-mono text-xs', textColors.secondary)}>
              {resource.resource_id}
            </td>
            <td className={cn(tableStyles.cell, 'text-xs', textColors.tertiary)}>
              {resource.resource_type}
            </td>
            <td className={cn(tableStyles.cell, 'text-xs', textColors.tertiary)}>
              {resource.database_type ?? '-'}
            </td>
            <td className={cn(tableStyles.cell, 'text-xs', textColors.tertiary)}>
              {resource.credential_id ?? '-'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
