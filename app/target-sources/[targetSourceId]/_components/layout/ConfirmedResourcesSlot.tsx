'use client';

import { cardStyles, cn, textColors } from '@/lib/theme';
import { ConfirmedIntegrationTable } from '@/app/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable';
import { ErrorRow, ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { useConfirmedIntegration } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

interface ConfirmedResourcesSlotProps {
  bare?: boolean;
}

export const ConfirmedResourcesSlot = ({ bare }: ConfirmedResourcesSlotProps = {}) => {
  const { locale } = useLocale();
  const t = LAYOUT_COPY[locale].confirmedSlot;
  const { state, retry, targetSourceId } = useConfirmedIntegration();

  const body =
    state.status === 'loading' ? (
      <ResourceTableSkeleton />
    ) : state.status === 'error' ? (
      <ErrorRow message={state.message} onRetry={retry} />
    ) : (
      <ConfirmedIntegrationTable confirmed={state.data} targetSourceId={targetSourceId} />
    );

  if (bare) {
    return <div data-testid="confirmed-resources">{body}</div>;
  }

  return (
    <div data-testid="confirmed-resources">
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cardStyles.header}>
          <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>
            {t.title}
          </h2>
          <p className={cn('mt-1 text-xs', textColors.tertiary)}>
            {t.subtitle}
          </p>
        </header>
        {body}
      </section>
    </div>
  );
};
