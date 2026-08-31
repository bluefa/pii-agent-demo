'use client';

import { useRef, useState } from 'react';
import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { IDC_REASON_MAXLEN } from '@/lib/constants/idc';
import { cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';

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
  const t = IDC_COPY[useLocale().locale];
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
      title={t.exclCustomTitle}
      // 한 문장·한 줄 — 중간 줄바꿈이 생기던 두 문장 안내를 접었다. 대상은 DB가
      // 아니라 리소스이고, 강조는 승인 모달 문법대로 핵심 구절 하나만 파랑.
      description={
        <>
          {t.exclCustomDescBefore}
          <span className={primaryColors.text}>{t.exclCustomDescEm}</span>
          {t.exclCustomDescAfter}
        </>
      }
      confirmLabel={t.save}
      cancelLabel={t.cancel}
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
          placeholder={t.exclReasonPlaceholder}
          className={idcStyles.textarea}
        />
        {/* 두 톤 카운터 — 변하는 수(현재 길이)만 진하게, 고정 분모는 흐리게.
            한도에 닿으면 현재 길이가 error 색으로 바뀌어 "왜 더 안 쳐지는지"를 말한다. */}
        <div className="text-right text-[12px] tabular-nums">
          <span className={cn('font-semibold', atLimit ? statusColors.error.text : textColors.secondary)}>
            {text.length.toLocaleString()}
          </span>
          <span className={textColors.tertiary}>
            {' '}
            / {maxLen.toLocaleString()}
            {t.charUnit}
          </span>
        </div>
      </div>
    </ConfirmStepModal>
  );
};
