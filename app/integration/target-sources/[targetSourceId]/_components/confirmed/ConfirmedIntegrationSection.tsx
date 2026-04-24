'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import { cardStyles, cn, textColors } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';
import { ErrorRow, LoadingRow } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { getConfirmedErrorMessage } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/errors';
import { ConfirmedIntegrationTable } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable';

interface ConfirmedIntegrationSectionProps {
  targetSourceId: number;
  onConfirmedLoaded?: (confirmed: readonly ConfirmedResource[]) => void;
}

export const ConfirmedIntegrationSection = ({
  targetSourceId,
  onConfirmedLoaded,
}: ConfirmedIntegrationSectionProps) => {
  const [state, setState] = useState<AsyncState<ConfirmedResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  // Keep callback identity out of effect deps so a non-memoized caller cannot
  // re-trigger the fetch effect.
  const onLoadedRef = useRef(onConfirmedLoaded);
  useEffect(() => {
    onLoadedRef.current = onConfirmedLoaded;
  }, [onConfirmedLoaded]);

  useEffect(() => {
    const controller = new AbortController();

    void getConfirmedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const data = confirmedIntegrationToConfirmed(response);
        setState({ status: 'ready', data });
        onLoadedRef.current?.(data);
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (isMissingConfirmedIntegrationError(error)) {
          setState({ status: 'ready', data: [] });
          onLoadedRef.current?.([]);
          return;
        }
        setState({ status: 'error', message: getConfirmedErrorMessage(error) });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cardStyles.header}>
        <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>
          연동 대상 정보
        </h2>
        <p className={cn('mt-1 text-xs', textColors.tertiary)}>
          관리자 확정된 연동 대상 DB 목록입니다.
        </p>
      </header>
      {state.status === 'loading' ? (
        <LoadingRow message="불러오는 중..." />
      ) : state.status === 'error' ? (
        <ErrorRow message={state.message} onRetry={handleRetry} />
      ) : (
        <ConfirmedIntegrationTable confirmed={state.data} />
      )}
    </section>
  );
};
