'use client';

import type { ReactNode } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { StatusWarningIcon } from '@/app/components/ui/icons';
import { cn, textColors } from '@/lib/theme';

export type ConfirmRewindKind = 'infra' | 'retest';

interface ConfirmStepContent {
  title: string;
  desc: ReactNode;
  note: string;
}

// v16 openConfirmStep content map (HTML 10131). `infra` rewinds to step 1, `retest`
// rewinds to step 5; both reset the downstream progress.
const CONTENT: Record<ConfirmRewindKind, ConfirmStepContent> = {
  retest: {
    title: '연결 테스트를 다시 실행할까요?',
    desc: (
      <>
        <strong className={cn('font-semibold', textColors.secondary)}>5단계 · 연결 테스트</strong>
        로 되돌아갑니다. 이후 단계의 진행 상태는 다시 시작돼요.
      </>
    ),
    note: '연결 테스트 결과에 따라 6 · 7단계의 상태가 초기화될 수 있어요.',
  },
  infra: {
    title: '인프라를 변경하시겠어요?',
    desc: (
      <>
        <strong className={cn('font-semibold', textColors.secondary)}>
          1단계 · 연동 대상 DB 선택
        </strong>
        으로 되돌아갑니다. 변경 후에는 전체 프로세스를 다시 진행해야 해요.
      </>
    ),
    note: '진행 중이던 Agent 설치·승인·연결 테스트 결과는 모두 초기화돼요.',
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
 * this file owns only what is specific to a rewind: the amber consequence well and the
 * `warning` tone on the commit button. Open when `kind` is non-null.
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
      description={content.desc}
      confirmLabel="되돌아가기"
      tone="warning"
    >
      {/* What gets reset, stated once, in the body slot the shared dialog reserves for it. The
          icon keeps the warning off color alone (WCAG 1.4.1); amber-800 on #FFFBEB is 8.1:1. */}
      <div className="flex items-start gap-2.5 rounded-[10px] border border-[#FCD34D] bg-[#FFFBEB] px-3.5 py-3 text-[12.5px] font-medium leading-[1.55] text-[#92400E]">
        <StatusWarningIcon className="mt-px h-4 w-4 flex-shrink-0" />
        <span>{content.note}</span>
      </div>
    </ConfirmStepModal>
  );
};
