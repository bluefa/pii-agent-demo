'use client';

import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import {
  borderColors,
  cn,
  numericFeatures,
  primaryColors,
  textColors,
  tossShadow,
} from '@/lib/theme';

interface IdcSubmitModalProps {
  isOpen: boolean;
  total: number;
  live: number;
  excluded: number;
  /** 요청의 진행 프레임 (useConfirmSubmit). */
  phase: ConfirmSubmitPhase;
  /** 실패 사유 한 줄. 서버가 준 사용자용 메시지일 때만 값이 있다. */
  errorReason?: string;
  /** 요청하기 — parent runs createApprovalRequest + refreshProject. */
  onSubmit: () => void;
  /** 다시 요청하기 — 재요청 전에 진행 상태를 다시 읽는다(useConfirmSubmit). */
  onRetry: () => void;
  /** 머무르기 / 실패 프레임의 닫기. */
  onClose: () => void;
}

/**
 * 프레임별 결과 문구. 확인 프레임은 건수를 다시 말하지 않는다 — 방금 그 숫자를
 * 보고 누른 사용자에게 같은 수를 되돌려주는 대신, 다음에 무슨 일이 일어나는지만
 * 말한다(스캔 완료 프레임이 발견 건수를 말하지 않는 것과 같은 이유).
 */
const RESULTS: Record<'success' | 'error', ConfirmStepResult> = {
  success: {
    kind: 'success',
    title: '승인 요청을 보냈어요',
    description: '잠시 후 승인 대기 단계로 이동해요.',
  },
  error: {
    kind: 'error',
    title: '승인 요청을 보내지 못했어요',
    // 실패가 지운 것이 없다는 말이 먼저다 — 입력·선택·제외 사유가 그대로라는 것을
    // 모르면 사용자는 다시 요청하기보다 화면을 처음부터 확인하려 든다.
    description: '연동 대상은 그대로 남아 있어요. 다시 요청해 주세요.',
  },
};

const UNKNOWN_REASON = '알 수 없는 오류가 발생했어요.';

interface StatProps {
  label: string;
  value: number;
  valueClass?: string;
}

// Centered tile, 36px number: the three counts ARE the modal's payload, so they
// carry the display tier while the label stays quiet above them. No status dots —
// the blue number already marks the one count that matters.
// White card + toss shadow(lg) + default stroke — the hairline closes the card
// where the soft shadow alone leaves the edge fuzzy.
const Stat = ({ label, value, valueClass }: StatProps) => (
  <div className={cn('rounded-xl border bg-white px-4 py-4 text-center', borderColors.default, tossShadow.lg)}>
    {/* medium보다 한 단계 위(semibold)만 — 숫자(bold)와의 위계는 유지한다. */}
    <div className={cn('text-[14px] font-semibold', textColors.tertiary)}>
      {label}
    </div>
    <div className={cn('mt-1 text-[40px] font-bold leading-[1.2]', numericFeatures.tabular, valueClass ?? textColors.primary)}>
      {value}
      <span className={cn('ml-1 text-[13px] font-medium', textColors.tertiary)}>건</span>
    </div>
  </div>
);

/**
 * Approval-request confirmation on the unified step-flow confirm grammar
 * (ConfirmStepModal): question title, one cause→effect sentence, compact
 * button pair, no close-X, no footer hairline. Body = the three counts.
 */
export const IdcSubmitModal = ({
  isOpen,
  total,
  live,
  excluded,
  phase,
  errorReason,
  onSubmit,
  onRetry,
  onClose,
}: IdcSubmitModalProps) => (
  <ConfirmStepModal
    open={isOpen}
    onClose={onClose}
    onConfirm={onSubmit}
    isPending={phase === 'pending'}
    result={
      phase === 'success'
        ? RESULTS.success
        : phase === 'error'
          ? { ...RESULTS.error, reason: errorReason ?? UNKNOWN_REASON }
          : null
    }
    onRetry={onRetry}
    title="연동 대상을 승인 요청할까요?"
    // 꼭 알아야 하는 정보만 파란색으로, 굵기는 본문과 동일하게 — 강조는 행동
    // 문구("N건을 연동 대상으로 요청해요") 하나뿐이다. 취소 경로 문장은 평문.
    description={
      <>
        전체 {total}건 중{' '}
        <span className={primaryColors.text}>{live}건을 연동 대상으로 요청해요</span>.
        요청 후에는 관리자 검토가 시작되고, 변경하려면 취소 후 다시 요청해야 해요.
      </>
    }
    confirmLabel="요청하기"
    wide
  >
    {/* 타일 라벨은 Step 2 통계(WaitingApprovalStats)와 동일한 용어를 쓴다:
        전체 요청 / 연동 요청 대상 / 연동 요청 제외대상. */}
    <div className="grid grid-cols-3 gap-3">
      <Stat label="전체 요청" value={total} />
      <Stat label="연동 요청 대상" value={live} valueClass={primaryColors.text} />
      <Stat label="연동 요청 제외대상" value={excluded} />
    </div>
  </ConfirmStepModal>
);
