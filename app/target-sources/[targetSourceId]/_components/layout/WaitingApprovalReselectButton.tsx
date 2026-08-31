'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { ArrowUpRightIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { confirmApprovalUnavailable } from '@/app/lib/api';
import { cn, idcStyles, primaryColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

interface WaitingApprovalReselectButtonProps {
  targetSourceId: number;
  onSuccess: () => Promise<void> | void;
}

/**
 * Step 2, rejected sub-state — go back to Step 1 and pick targets again.
 *
 * NOT approval-requests/cancel: that endpoint cancels "the latest PENDING approval request" and
 * answers 404 (no pending request) / 409 (already processed) for a rejected one. The verdict has
 * already been made here, so this acknowledges it via approval-unavailable/confirm, which returns
 * the source to its initial state regardless of which verdict closed the request.
 */
export const WaitingApprovalReselectButton = ({
  targetSourceId,
  onSuccess,
}: WaitingApprovalReselectButtonProps) => {
  const modal = useModal();
  const { locale } = useLocale();
  const copy = LAYOUT_COPY[locale];

  const { mutate, loading } = useApiMutation<void, Awaited<ReturnType<typeof confirmApprovalUnavailable>>>(
    () => confirmApprovalUnavailable(targetSourceId),
    { errorMessage: copy.common.genericFailure },
  );

  const handleConfirm = async () => {
    const result = await mutate();
    if (!result) return;
    modal.close();
    await onSuccess();
  };

  return (
    <>
      {/* Blue underlined action with a forward arrow, docked on the reason block's signature row —
          the verdict group carries its own way out instead of a loud standalone button under it. */}
      <button
        type="button"
        className={idcStyles.triggerBtn.linkPrimary}
        onClick={() => modal.open()}
      >
        {copy.waiting.reselect}
        <ArrowUpRightIcon className="h-[13px] w-[13px]" />
      </button>

      {/* The title is the pre-flight nudge — once the user moves on, the reason leaves the
          screen, so "did you read it?" is the one question worth asking. Confirm stays blue
          (default variant): recovery step, not a destructive one. No loss banner: re-selecting
          replaces a draft, not a record.
          ⚠️ The earlier reason — "the history stays visible in 진행 내역" — no longer holds. That
          tab is gone (오너 지시 2026-08-23) and was mock data before it. See
          WaitingApprovalCancelButton for the same note. */}
      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title={copy.waiting.reselectTitle}
        description={
          // The payload is "you go BACK to step 1" — so the emphasis sits on 1단계 (a short
          // token, so no particle-boundary mush) in brand blue, and the sentence links the
          // 확인 button to its consequence directly. The screen name doubles as the restart
          // activity.
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
    </>
  );
};
