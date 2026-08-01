'use client';

import { useRef, useState } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { IDC_REASON_MAXLEN } from '@/lib/constants/idc';
import { cn, idcStyles, statusColors, textColors } from '@/lib/theme';

interface IdcExclusionReasonModalProps {
  isOpen: boolean;
  /** Prefill when editing an existing custom reason. */
  initialReason?: string;
  /** Max reason length — IDC default 200; cloud passes its own cap. */
  maxLen?: number;
  /** Saved a non-empty reason. */
  onSave: (reason: string) => void;
  /** Closed without saving — parent reverts the check if no reason exists yet. */
  onClose: () => void;
}

/**
 * Free-text exclusion reason (≤maxLen chars, char counter). Saving requires a
 * non-empty value; closing without saving reverts via `onClose`.
 *
 * Built on ConfirmStepModal so it shares the confirm-dialog spec exactly
 * (480px, h-40 footer pair, no X, no footer hairline, focus restore) — the
 * previous Modal-chrome version had its own button tier/divider and read as
 * a different system next to the approval confirms.
 */
export const IdcExclusionReasonModal = ({
  isOpen,
  initialReason = '',
  maxLen = IDC_REASON_MAXLEN,
  onSave,
  onClose,
}: IdcExclusionReasonModalProps) => {
  const [text, setText] = useState(initialReason);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const canSave = trimmed !== '';
  const atLimit = text.length >= maxLen;

  return (
    <ConfirmStepModal
      open={isOpen}
      onClose={onClose}
      onConfirm={() => onSave(trimmed)}
      title="제외 사유 직접 입력"
      description="이 DB를 연동 대상에서 제외하는 이유를 입력해주세요. 관리자 승인 시 함께 전달돼요."
      confirmLabel="저장"
      cancelLabel="취소"
      confirmDisabled={!canSave}
      initialFocus={textareaRef}
    >
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          maxLength={maxLen}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: Stg 환경 DB이며 운영 데이터가 아닌 익명화된 샘플 데이터만 보관하고 있어 제외합니다."
          className={idcStyles.textarea}
        />
        {/* 두 톤 카운터 — 변하는 수(현재 길이)만 진하게, 고정 분모는 흐리게.
            한도에 닿으면 현재 길이가 error 색으로 바뀌어 "왜 더 안 쳐지는지"를 말한다. */}
        <div className="text-right text-[12px] tabular-nums">
          <span className={cn('font-semibold', atLimit ? statusColors.error.text : textColors.secondary)}>
            {text.length.toLocaleString()}
          </span>
          <span className={textColors.quaternary}> / {maxLen.toLocaleString()}자</span>
        </div>
      </div>
    </ConfirmStepModal>
  );
};
