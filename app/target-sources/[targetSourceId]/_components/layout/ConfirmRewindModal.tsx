'use client';

import type { ReactNode } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { cn, primaryColors, statusColors } from '@/lib/theme';

export type ConfirmRewindKind = 'infra' | 'retest';

interface ConfirmStepContent {
  title: string;
  desc: ReactNode;
  note: string;
}

/**
 * Copy grammar is the step-flow confirm grammar (WaitingApprovalCancelButton,
 * WaitingApprovalReselectButton, ApprovalUnavailableCard): a question title, then ONE
 * cause→effect sentence that starts at the 확인 button and names the step it lands on in
 * brand blue. The well below states what is lost — the one thing the sentence cannot say
 * without running to two lines. `infra` rewinds to step 1, `retest` to step 5.
 */
const CONTENT: Record<ConfirmRewindKind, ConfirmStepContent> = {
  retest: {
    // Matches the trigger's wording (연결 재확인) rather than restating the step name.
    title: '연결을 다시 확인할까요?',
    desc: (
      <>
        {'확인을 누르면 '}
        <strong className={cn('font-semibold', primaryColors.text)}>5단계</strong>
        {'로 돌아가, 연결 테스트부터 다시 진행해요.'}
      </>
    ),
    // Was "결과에 따라 … 초기화될 수 있어요" — the reset is not conditional on the result,
    // it happens the moment the step rewinds. A hedge on a warning reads as noise.
    note: '지금까지의 6 · 7단계 진행 상태는 초기화돼요.',
  },
  infra: {
    title: '인프라를 변경할까요?',
    desc: (
      <>
        {'확인을 누르면 '}
        <strong className={cn('font-semibold', primaryColors.text)}>1단계</strong>
        {'로 돌아가, 연동 대상 DB 선택부터 다시 진행해요.'}
      </>
    ),
    note: '진행 중이던 Agent 설치 · 승인 · 연결 테스트 결과는 모두 초기화돼요.',
  },
};

interface ConfirmRewindModalProps {
  kind: ConfirmRewindKind | null;
  onClose: () => void;
  onConfirm: (kind: ConfirmRewindKind) => void;
}

/**
 * Confirm-rewind dialog — the 인프라 변경 / 연결 재확인 actions open this before rewinding
 * the step. Runs on the shared ConfirmStepModal chrome (steps 1·2·3 open the same dialog), so
 * this file owns only what is specific to a rewind: the consequence line and the `warning`
 * tone on the commit button. Open when `kind` is non-null.
 */
export const ConfirmRewindModal = ({ kind, onClose, onConfirm }: ConfirmRewindModalProps) => {
  if (!kind) return null;
  const content = CONTENT[kind];

  return (
    <ConfirmStepModal
      open
      onClose={onClose}
      onConfirm={() => onConfirm(kind)}
      title={content.title}
      // Both lines live in the description block, not in the dialog's body slot: that slot
      // adds 16px, and the app sets consecutive paragraphs with no margin at all — the
      // leading is the break (WaitingApprovalCard). `block` inside the description <p>, so
      // the second line inherits modalStyles.toss.subtitle's 14px / 1.6 and only the color
      // and weight change. Color carries the emphasis; the sentence still states the
      // consequence in words, so nothing rides on hue alone (WCAG 1.4.1). orange-800 is
      // 6.5:1 on white.
      description={
        <>
          {content.desc}
          <span className={cn('block font-semibold', statusColors.warning.textDark)}>
            {content.note}
          </span>
        </>
      }
      confirmLabel="확인"
      tone="warning"
    />
  );
};
