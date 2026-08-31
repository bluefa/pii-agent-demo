'use client';

import { useCallback } from 'react';
import { confirmApprovalUnavailable } from '@/app/lib/api';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { StepBanner } from '@/app/components/ui/StepBanner';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { cardStyles, cn, confirmModalStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

interface ApprovalUnavailableCardProps {
  targetSourceId: number;
  reason: string;
  onReselected?: () => Promise<void> | void;
}

/**
 * Step 2, integration-unavailable sub-state. The admin judged the requested targets
 * un-integratable (approval-requests/latest → result.status === 'UNAVAILABLE'). Surfaces
 * the reason and the single go-back recovery action: confirmApprovalUnavailable
 * acknowledges the verdict and returns the source to its initial state (Step 1).
 */
export const ApprovalUnavailableCard = ({
  targetSourceId,
  reason,
  onReselected,
}: ApprovalUnavailableCardProps) => {
  const modal = useModal();
  const { locale } = useLocale();
  const copy = LAYOUT_COPY[locale];
  const t = copy.unavailable;
  const { mutate, loading } = useApiMutation<void, Awaited<ReturnType<typeof confirmApprovalUnavailable>>>(
    () => confirmApprovalUnavailable(targetSourceId),
    { errorMessage: copy.common.genericFailure },
  );

  const handleConfirm = useCallback(async () => {
    const result = await mutate();
    if (!result) return;
    modal.close();
    await onReselected?.();
  }, [modal, mutate, onReselected]);

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cn(cardStyles.cardTitle)}>{t.title}</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            {t.subtitle}
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
            statusColors.error.bg,
            statusColors.error.textDark,
          )}
        >
          <span className={cn('w-1.5 h-1.5 rounded-full', statusColors.error.dot)} />
          {t.badge}
        </span>
      </div>

      <div className="p-6">
        <StepBanner variant="error" icon={<StatusWarningIcon className="w-[18px] h-[18px]" />}>
          <strong className="font-semibold">{t.bannerStrong}</strong>
          {reason ? <>{' · '}{t.reasonPrefix}{reason}</> : null}
        </StepBanner>

        <p className={cn('mt-4 text-sm', textColors.secondary)}>
          {t.guidance}
        </p>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            className={cn(confirmModalStyles.outlineButton, 'gap-1.5 text-[13px]')}
            onClick={() => modal.open()}
          >
            {t.goBack}
          </button>
        </div>
      </div>

      {/* Same grammar as the rejected-state reselect modal: pre-flight question (the reason
          leaves the screen once we move on), one cause→effect sentence with 1단계 in brand
          blue, blue 확인. No loss banner.
          ⚠️ Not because "the history stays in 진행 내역" — that tab is gone (오너 지시
          2026-08-23) and was mock data before it. See WaitingApprovalCancelButton. */}
      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title={t.confirmTitle}
        description={
          <>
            {copy.rewindTo.targetDb.lead}
            <strong className={cn('font-semibold', primaryColors.text)}>
              {copy.common.step(1)}
            </strong>
            {copy.rewindTo.targetDb.tail}
          </>
        }
        confirmLabel={copy.common.ok}
        isPending={loading}
      />
    </section>
  );
};
