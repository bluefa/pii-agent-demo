'use client';

import { cardStyles, cn, textColors } from '@/lib/theme';
import {
  ConfirmedIntegrationTable,
  type ConfirmedIntegrationTableVariant,
} from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable';
import { ErrorRow, LoadingRow } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { useConfirmedIntegration } from '@/app/integration/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';

interface ConfirmedResourcesSlotProps {
  variant?: ConfirmedIntegrationTableVariant;
  bare?: boolean;
}

export const ConfirmedResourcesSlot = ({ variant, bare }: ConfirmedResourcesSlotProps = {}) => {
  const { state, retry, targetSourceId } = useConfirmedIntegration();

  const body =
    state.status === 'loading' ? (
      <LoadingRow message="불러오는 중..." />
    ) : state.status === 'error' ? (
      <ErrorRow message={state.message} onRetry={retry} />
    ) : (
      <ConfirmedIntegrationTable
        confirmed={state.data}
        variant={variant}
        targetSourceId={targetSourceId}
      />
    );

  if (bare) {
    return <div data-testid="confirmed-resources">{body}</div>;
  }

  return (
    <div data-testid="confirmed-resources">
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cardStyles.header}>
          <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>
            연동 대상 정보
          </h2>
          <p className={cn('mt-1 text-xs', textColors.tertiary)}>
            관리자 확정된 연동 대상 DB 목록입니다.
          </p>
        </header>
        {body}
      </section>
    </div>
  );
};
