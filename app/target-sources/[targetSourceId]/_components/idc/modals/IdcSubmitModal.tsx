'use client';

import { ConfirmStepModal, type ConfirmStepResult } from '@/app/components/ui/ConfirmStepModal';
import type { ConfirmSubmitPhase } from '@/app/hooks/useConfirmSubmit';
import type { AppErrorCode } from '@/lib/errors';
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
  /** 지금 그릴 프레임 (useConfirmSubmit). */
  phase: ConfirmSubmitPhase;
  /** 요청이 날아가 있는 동안 — 프레임은 그대로, 버튼만 잠긴다. */
  pending: boolean;
  /** 실패의 종류. 사용자가 읽을 한 줄은 여기(REASONS)에서 고른다. */
  errorCode?: AppErrorCode;
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
    description: '연동 대상은 그대로 남아 있어요.',
  },
};

/**
 * 실패 한 건당 사유 한 줄과, **다시 눌러서 풀리는 실패인지**.
 *
 * 사유는 에러 **코드**로 고른다. 서버 detail 과 AppError.message 는 진단용이고
 * (ADR-008 개정 2026-04-27 / ADR-013 §D2), 그대로 렌더하면 BFF 가 쓴 문구가 그대로 UI
 * 카피가 된다. 코드는 fetchJson 이 좁은 allowlist 로 정규화한 값이라 — 서버의
 * CONFLICT_REQUEST_PENDING 같은 도메인 코드는 status 로 접혀 CONFLICT 로 온다 — 여기
 * 나열된 것이 이 화면에 실제로 도달할 수 있는 전부다.
 *
 * `retry` 는 AppError.retriable 이 아니다. 그쪽은 전송 계층의 재시도 가능성이라 409 를
 * false 로 준다. 하지만 이 화면의 다시 요청하기는 재요청 전에 진행 상태를 다시 읽으므로
 * (useConfirmSubmit), 409 야말로 가장 잘 풀리는 경우다 — 이미 접수된 요청을 찾아 그대로
 * 다음 단계로 넘긴다. 반대로 권한·입력 문제는 같은 손으로 다시 눌러도 같은 실패다.
 */
interface FailureCopy {
  reason: string;
  retry: boolean;
}

const FAILURES: Partial<Record<AppErrorCode, FailureCopy>> = {
  CONFLICT: { reason: '이미 진행 중인 승인 요청이 있어요.', retry: true },
  INTERNAL_ERROR: { reason: '서버에서 오류가 발생했어요.', retry: true },
  RATE_LIMITED: { reason: '요청이 잠시 몰렸어요. 잠시 후 다시 요청해 주세요.', retry: true },
  NETWORK: { reason: '네트워크 연결을 확인해 주세요.', retry: true },
  TIMEOUT: { reason: '응답이 늦어지고 있어요. 잠시 후 다시 요청해 주세요.', retry: true },
  BAD_REQUEST: { reason: '요청 내용을 다시 확인해 주세요.', retry: false },
  UNAUTHORIZED: { reason: '로그인이 만료됐어요. 새로고침한 뒤 다시 요청해 주세요.', retry: false },
  FORBIDDEN: { reason: '이 연동 대상에 승인을 요청할 권한이 없어요.', retry: false },
  NOT_FOUND: { reason: '연동 대상을 찾을 수 없어요. 새로고침한 뒤 다시 요청해 주세요.', retry: false },
};

/** 분류할 수 없는 실패는 다시 눌러볼 값어치가 있다 — 일시적일 수 있다는 게 유일한 정보다. */
const UNKNOWN_FAILURE: FailureCopy = { reason: '알 수 없는 오류가 발생했어요.', retry: true };

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
  pending,
  errorCode,
  onSubmit,
  onRetry,
  onClose,
}: IdcSubmitModalProps) => {
  const failure = (errorCode && FAILURES[errorCode]) ?? UNKNOWN_FAILURE;
  return (
  <ConfirmStepModal
    open={isOpen}
    onClose={onClose}
    onConfirm={onSubmit}
    isPending={pending}
    result={
      phase === 'success'
        ? RESULTS.success
        : phase === 'error'
          ? { ...RESULTS.error, reason: failure.reason }
          : null
    }
    // 다시 눌러도 같은 실패인 것에는 버튼을 주지 않는다 — 지키지 못할 약속이고,
    // "새로고침한 뒤 다시 요청해 주세요" 옆의 다시 요청하기는 그 자체로 모순이다.
    onRetry={failure.retry ? onRetry : undefined}
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
};
