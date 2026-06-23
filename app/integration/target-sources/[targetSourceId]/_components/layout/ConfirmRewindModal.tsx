'use client';

import { useEffect, type ReactNode } from 'react';
import { cn, modalStyles, textColors } from '@/lib/theme';
import { WARNING_OUTLINE_BUTTON_CLASS } from '@/app/integration/target-sources/[targetSourceId]/_components/common/warning-outline-button';

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
        <strong className="font-semibold">5단계 · 연결 테스트</strong>로 되돌아갑니다. 이후 단계의 진행 상태는
        다시 시작돼요.
      </>
    ),
    note: '연결 테스트 결과에 따라 6 · 7단계의 상태가 초기화될 수 있어요.',
  },
  infra: {
    title: '인프라를 변경하시겠어요?',
    desc: (
      <>
        <strong className="font-semibold">1단계 · 연동 대상 DB 선택</strong>으로 되돌아갑니다. 변경 후에는 전체
        프로세스를 다시 진행해야 해요.
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
 * Confirm-rewind dialog — v16 `#confirmStepModal` (440px, HTML 8212). The 인프라 변경 /
 * 연결 테스트 재실행 actions open this amber warning dialog before rewinding the step.
 * Open when `kind` is non-null.
 */
export const ConfirmRewindModal = ({ kind, onClose, onConfirm }: ConfirmRewindModalProps) => {
  useEffect(() => {
    if (!kind) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [kind, onClose]);

  if (!kind) return null;
  const content = CONTENT[kind];

  return (
    <div
      className={modalStyles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="mx-4 w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
      >
        <div className="flex items-start gap-3.5 px-7 pb-3 pt-7">
          <div className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full bg-[#FEF3C7] text-[#B45309]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div>
            <h2 className="mb-1.5 mt-0.5 text-[26px] font-extrabold leading-[1.25] tracking-[-0.03em] text-[#191F28]">
              {content.title}
            </h2>
            <p className={cn('text-[13px] font-medium leading-[1.55]', textColors.tertiary)}>{content.desc}</p>
          </div>
        </div>
        <div className="px-7 pt-1">
          <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2.5 text-[12px] leading-[1.55] text-[#92400E]">
            {content.note}
          </div>
        </div>
        <div className="flex justify-end gap-2 px-7 pb-6 pt-5">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'rounded-lg border px-4 py-2 text-[13px] font-medium transition-colors',
              'border-[#E5E8EB] text-[#4E5968] hover:bg-[#F2F4F6]',
            )}
          >
            머무르기
          </button>
          <button type="button" onClick={() => onConfirm(kind)} className={WARNING_OUTLINE_BUTTON_CLASS}>
            되돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};
