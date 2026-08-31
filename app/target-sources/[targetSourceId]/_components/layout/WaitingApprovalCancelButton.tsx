'use client';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { ReloadIcon } from '@/app/components/ui/icons';
import { useApiMutation } from '@/app/hooks/useApiMutation';
import { useModal } from '@/app/hooks/useModal';
import { cancelApprovalRequest } from '@/app/lib/api';
import { cn, idcStyles, primaryColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';

interface WaitingApprovalCancelButtonProps {
  targetSourceId: number;
  onSuccess: () => Promise<void> | void;
}

/** PENDING requests only — a rejected one uses WaitingApprovalReselectButton (cancel rejects it). */
export const WaitingApprovalCancelButton = ({
  targetSourceId,
  onSuccess,
}: WaitingApprovalCancelButtonProps) => {
  const modal = useModal();
  const { locale } = useLocale();
  const copy = LAYOUT_COPY[locale];
  const t = copy.waiting;

  const { mutate, loading } = useApiMutation<void, { success: boolean }>(
    () => cancelApprovalRequest(targetSourceId),
    {
      errorMessage: t.cancelFailed,
    },
  );

  const handleConfirm = async () => {
    const result = await mutate();
    if (!result?.success) return;
    modal.close();
    await onSuccess();
  };

  return (
    <>
      {/* A rewind, not a deletion — reuses the existing warnOutline (amber) tone shared with the IDC
          "rerun connection test" action. The modal states that the request is cancelled. */}
      <button
        type="button"
        className={idcStyles.triggerBtn.warnOutline}
        onClick={() => modal.open()}
      >
        <ReloadIcon className="w-[13px] h-[13px]" />
        {t.reRequest}
      </button>

      {/* Same grammar as the rejected-state reselect modal: question title, one cause→effect
          sentence with 1단계 in brand blue, blue 확인. No loss banner, because cancelling is a
          rewind and not a deletion.
          ⚠️ It used to also say "the history stays visible in 진행 내역". That tab is gone
          (오너 지시 2026-08-23), and it was hardcoded mock rows before that — so the claim was
          never true for a real request. There is now NO surface showing a user their own
          request history; if that turns out to matter, this modal is where the warning goes. */}
      <ConfirmStepModal
        open={modal.isOpen}
        onClose={modal.close}
        onConfirm={() => {
          void handleConfirm();
        }}
        title={t.cancelTitle}
        description={
          // Kept to one rendered line in the 480px dialog: '진행 중인' and the screen name are
          // dropped — the request can only be the current one, and 1단계 already names the place.
          <>
            {copy.rewindTo.afterCancel.lead}
            <strong className={cn('font-semibold', primaryColors.text)}>
              {copy.common.step(1)}
            </strong>
            {copy.rewindTo.afterCancel.tail}
          </>
        }
        confirmLabel={copy.common.ok}
        isPending={loading}
      />
    </>
  );
};
