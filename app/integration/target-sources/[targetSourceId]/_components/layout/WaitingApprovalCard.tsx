'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  getApprovedIntegration,
  type ApprovedIntegrationExcludedResourceItem,
  type ApprovedIntegrationResourceItem,
} from '@/app/lib/api';
import { AppError, isMissingApprovedIntegrationError } from '@/lib/errors';
import { ClockIcon } from '@/app/components/ui/icons';
import { StepBanner } from '@/app/components/ui/StepBanner';
import {
  WaitingApprovalTable,
  type WaitingApprovalResource,
} from '@/app/integration/target-sources/[targetSourceId]/_components/layout/WaitingApprovalTable';
import {
  ErrorRow,
  LoadingRow,
} from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';
import { cardStyles, cn, statusColors, textColors } from '@/lib/theme';

interface WaitingApprovalCardProps {
  targetSourceId: number;
  cancelSlot?: ReactNode;
  reselectSlot?: ReactNode;
}

const FETCH_ERROR_MESSAGE = '승인 요청 정보를 불러오지 못했습니다.';

const toSelectedRow = (item: ApprovedIntegrationResourceItem): WaitingApprovalResource => ({
  resourceId: item.resource_id,
  resourceType: item.resource_type,
  region: item.database_region ?? '',
  databaseName: item.resource_name ?? '',
  selected: true,
  scanStatus: item.scan_status ?? null,
});

const toExcludedRow = (
  item: ApprovedIntegrationExcludedResourceItem,
): WaitingApprovalResource => ({
  resourceId: item.resource_id ?? '',
  resourceType: item.database_type ?? '',
  region: item.database_region ?? '',
  databaseName: item.resource_name ?? '',
  selected: false,
  scanStatus: item.scan_status ?? null,
});

export const WaitingApprovalCard = ({
  targetSourceId,
  cancelSlot,
  reselectSlot,
}: WaitingApprovalCardProps) => {
  const [state, setState] = useState<AsyncState<WaitingApprovalResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void getApprovedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        const approved = response.approved_integration;
        if (!approved) {
          setState({ status: 'ready', data: [] });
          return;
        }
        const selectedRows = approved.resource_infos.map(toSelectedRow);
        const excludedRows = approved.excluded_resource_infos.map(toExcludedRow);
        setState({ status: 'ready', data: [...selectedRows, ...excludedRows] });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (isMissingApprovedIntegrationError(error)) {
          setState({ status: 'ready', data: [] });
          return;
        }
        setState({ status: 'error', message: FETCH_ERROR_MESSAGE });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn('text-lg font-semibold', textColors.primary)}>
            연동 대상 승인 대기
          </h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            요청하신 DB 목록을 관리자가 확인하고 있어요.
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            statusColors.warning.bg,
            statusColors.warning.textDark,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.warning.dot)} />
          승인 대기
        </span>
      </div>

      <div className="p-6">
        <StepBanner
          variant="info"
          icon={<ClockIcon className="w-[18px] h-[18px]" />}
        >
          <strong className="font-semibold">관리자 승인을 기다리고 있어요.</strong>
          {' '}평균 1영업일 내 검토되며, 승인되면 메일로 안내됩니다.
        </StepBanner>

        {state.status === 'loading' ? (
          <LoadingRow message="승인 요청 리소스를 불러오는 중입니다." />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : (
          <WaitingApprovalTable resources={state.data} />
        )}

        {(cancelSlot || reselectSlot) && (
          <div className="flex justify-end items-center gap-2 mt-4">
            {reselectSlot}
            {cancelSlot}
          </div>
        )}
      </div>
    </section>
  );
};
