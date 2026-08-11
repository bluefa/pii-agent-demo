'use client';

import { useRef, useState, type ReactNode } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';

export type ConfirmRewindKind = 'infra' | 'retest';

/** swagger TargetSourceResetRequestDto.reason 의 maxLength — 잘려 저장되기 전에 화면이 막는다. */
const RESET_REASON_MAXLEN = 1000;

interface ConfirmStepContent {
  title: string;
  desc: ReactNode;
  /** Only when the rewind destroys work the sentence above cannot imply — see `infra`. */
  note?: string;
}

/**
 * Copy grammar is the step-flow confirm grammar (WaitingApprovalCancelButton,
 * WaitingApprovalReselectButton, ApprovalUnavailableCard): a question title, then ONE
 * cause→effect sentence that starts at the 확인 button and names the step it lands on in
 * brand blue. A second line only where the rewind destroys work — `infra` unwinds a finished
 * installation, `retest` just moves the source back a step.
 */
const CONTENT: Record<ConfirmRewindKind, ConfirmStepContent> = {
  retest: {
    // Matches the trigger's wording (연결 재확인) rather than restating the step name.
    title: '연결을 다시 확인할까요?',
    // One sentence, no loss line. What happens IS "you go back to step 5" — the earlier
    // "6 · 7단계 진행 상태는 초기화돼요" restated that in the system's own bookkeeping terms,
    // and the sibling rewind dialog (step 2 → step 1) carries no loss line either.
    desc: (
      <>
        {'확인을 누르면 '}
        <strong className={cn('font-semibold', primaryColors.text)}>5단계</strong>
        {'로 돌아가, 연결 테스트부터 다시 진행해요.'}
      </>
    ),
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
    // Kept: this rewind throws away a completed installation, which the sentence above
    // does not imply.
    note: '이미 끝난 Agent 설치와 승인은 모두 사라져요.',
  },
};

interface ConfirmRewindModalProps {
  kind: ConfirmRewindKind | null;
  onClose: () => void;
  /** `reason` 은 `infra` 에서만 채워진다 — 초기화 API 가 요구하는 사유다. */
  onConfirm: (kind: ConfirmRewindKind, reason: string) => void;
  /** 요청이 나가 있는 동안 — 두 버튼과 배경·ESC 를 모두 잠근다. */
  isPending?: boolean;
}

/**
 * Confirm-rewind dialog — the 인프라 변경 / 연결 재확인 actions open this before rewinding
 * the step. Runs on the shared ConfirmStepModal chrome (steps 1·2·3 open the same dialog), so
 * this file owns only what is specific to a rewind: the consequence line, the `warning` tone
 * on the commit button, and — for `infra` — the reset reason the API requires. Open when
 * `kind` is non-null.
 */
export const ConfirmRewindModal = ({
  kind,
  onClose,
  onConfirm,
  isPending = false,
}: ConfirmRewindModalProps) => {
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  // 다른 되돌리기를 열면 앞서 쓰던 사유가 남아 있으면 안 된다. `kind` 가 null 이어도 이
  // 컴포넌트는 마운트된 채라(렌더 결과만 null) 상태가 저절로 비워지지 않는다 — 이 화면이
  // 쓰는 "이전 props" 패턴으로 직접 되돌린다.
  const [seededFor, setSeededFor] = useState(kind);
  if (seededFor !== kind) {
    setSeededFor(kind);
    setReason('');
  }

  if (!kind) return null;
  const content = CONTENT[kind];
  // 사유는 초기화 API 의 required 필드이고 감사 로그에 남는다 — 되돌릴 수 없는 쪽만 묻는다.
  const needsReason = kind === 'infra';
  const trimmedReason = reason.trim();

  return (
    <ConfirmStepModal
      open
      onClose={onClose}
      onConfirm={() => onConfirm(kind, trimmedReason)}
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
          {content.note && (
            <span className={cn('block font-semibold', statusColors.warning.textDark)}>
              {content.note}
            </span>
          )}
        </>
      }
      confirmLabel="확인"
      tone="warning"
      isPending={isPending}
      confirmDisabled={needsReason && trimmedReason === ''}
      initialFocus={needsReason ? reasonRef : undefined}
    >
      {needsReason && (
        // 사유 입력은 제외 사유 모달(IdcExclusionReasonModal)과 같은 물건이다 — 라벨,
        // borderless textarea, 두 톤 글자 수. 같은 것을 두 문법으로 적지 않는다.
        <div className="space-y-1.5">
          <label
            htmlFor="rewind-reset-reason"
            className={cn('block text-[12px] font-medium', textColors.tertiary)}
          >
            초기화 사유
          </label>
          <textarea
            id="rewind-reset-reason"
            ref={reasonRef}
            value={reason}
            maxLength={RESET_REASON_MAXLEN}
            rows={3}
            disabled={isPending}
            onChange={(event) => setReason(event.target.value)}
            placeholder="예: 운영 DB를 신규 VPC로 이전해 연동 대상 구성을 다시 잡아야 합니다."
            className={idcStyles.textarea}
          />
          {/* 두 톤 카운터 — 변하는 수(현재 길이)만 진하게, 고정 분모는 흐리게. 한도에 닿으면
              현재 길이가 error 색으로 바뀌어 "왜 더 안 쳐지는지"를 말한다. */}
          <div className="text-right text-[12px] tabular-nums">
            <span
              className={cn(
                'font-semibold',
                reason.length >= RESET_REASON_MAXLEN ? statusColors.error.text : textColors.secondary,
              )}
            >
              {reason.length.toLocaleString()}
            </span>
            <span className={textColors.tertiary}> / {RESET_REASON_MAXLEN.toLocaleString()}자</span>
          </div>
        </div>
      )}
    </ConfirmStepModal>
  );
};
