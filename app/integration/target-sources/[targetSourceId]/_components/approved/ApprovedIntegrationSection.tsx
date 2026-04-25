'use client';

import { useCallback, useEffect, useState } from 'react';
import { getApprovedIntegration } from '@/app/lib/api';
import { AppError, isMissingApprovedIntegrationError } from '@/lib/errors';
import { approvedIntegrationToApproved } from '@/lib/resource-catalog';
import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import { PlusIcon } from '@/app/components/ui/icons';
import type { ApprovedResource } from '@/lib/types/resources';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';
import { ErrorRow, LoadingRow } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { getApprovedErrorMessage } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/errors';
import { ApprovedIntegrationTable } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable';

interface ApprovedIntegrationSectionProps {
  targetSourceId: number;
}

export const ApprovedIntegrationSection = ({ targetSourceId }: ApprovedIntegrationSectionProps) => {
  const [state, setState] = useState<AsyncState<ApprovedResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void getApprovedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const infos = response.approved_integration?.resource_infos ?? [];
        setState({ status: 'ready', data: approvedIntegrationToApproved(infos) });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (isMissingApprovedIntegrationError(error)) {
          setState({ status: 'ready', data: [] });
          return;
        }
        setState({ status: 'error', message: getApprovedErrorMessage(error) });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  const approved = state.status === 'ready' ? state.data : [];

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className="px-6 pt-6">
        <h2 className={cn('text-lg font-semibold', textColors.primary)}>Cloud 리소스</h2>
      </div>

      <div className={cn('mx-6 mt-4 px-4 py-2 flex items-center gap-2 rounded-t-lg', statusColors.info.bg)}>
        <PlusIcon className={cn('w-4 h-4', statusColors.info.textDark)} />
        <span className={cn('text-sm font-medium', statusColors.info.textDark)}>
          연동 대상 리소스 ({approved.length}개)
        </span>
      </div>

      {state.status === 'loading' ? (
        <LoadingRow message="반영 중인 리소스 목록을 불러오는 중입니다." />
      ) : state.status === 'error' ? (
        <ErrorRow message={state.message} onRetry={handleRetry} />
      ) : (
        <ApprovedIntegrationTable approved={approved} />
      )}
    </section>
  );
};
