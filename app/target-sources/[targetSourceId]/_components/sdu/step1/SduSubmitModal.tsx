'use client';

import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import { approvalFailureCopy } from '@/app/components/ui/confirm-failures';
import { useLocale } from '@/app/components/LocaleProvider';
import {
  SDU_COPY,
  type SduDefineCopy,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import type { AppErrorCode } from '@/lib/errors';
import { cn, numericFeatures, primaryColors, textColors } from '@/lib/theme';

export interface SduSubmitModalProps {
  isOpen: boolean;
  targetCount: number;
  regionCount: number;
  phase: ConfirmSubmitPhase;
  pending: boolean;
  errorCode?: AppErrorCode;
  onSubmit: () => void;
  onRetry: () => void;
  onClose: () => void;
}

/**
 * SDU 에는 승인 절차가 없다 — 제출은 관리자에게 검토를 부탁하는 일이 아니라 곧바로
 * 데이터 업로드 단계로 넘어가는 일이다. 그래서 확인 문장이 말해야 할 것은 "누가 볼지"가
 * 아니라 **무엇이 만들어지는지**(Region 곳수 = 업로드 경로 수)다.
 */
const results = (t: SduDefineCopy): Record<'success' | 'error', ConfirmStepResult> => ({
  success: {
    kind: 'success',
    title: t.submitSuccessTitle,
    description: t.submitSuccessDescription,
  },
  error: {
    kind: 'error',
    title: t.submitErrorTitle,
    // 실패가 지운 것이 없다는 말이 먼저다 — 입력한 대상이 그대로라는 것을 모르면
    // 사용자는 다시 제출하기보다 화면을 처음부터 확인하려 든다.
    description: t.submitErrorDescription,
  },
});

export const SduSubmitModal = ({
  isOpen,
  targetCount,
  regionCount,
  phase,
  pending,
  errorCode,
  onSubmit,
  onRetry,
  onClose,
}: SduSubmitModalProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].define;
  const frames = results(t);
  const failure = approvalFailureCopy(errorCode, locale);
  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={onSubmit}
      isPending={pending}
      result={
        phase === 'success'
          ? frames.success
          : phase === 'error'
            ? { ...frames.error, reason: failure.reason }
            : null
      }
      onRetry={failure.retry ? onRetry : undefined}
      title={t.submitTitle}
      description={
        <>
          {t.submitDescriptionHead(targetCount, regionCount)}
          <span className={primaryColors.text}>{t.submitDescriptionPaths(regionCount)}</span>
          {t.submitDescriptionTail}
        </>
      }
      confirmLabel={t.submitConfirm}
      size="sm"
    >
      <p className={cn('text-[14px] font-medium', numericFeatures.tabular, textColors.tertiary)}>
        {t.submitFootnote}
      </p>
    </ConfirmStepModal>
  );
};
