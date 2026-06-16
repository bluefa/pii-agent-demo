'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { Modal } from '@/app/components/ui/Modal';
import { IDC_REASON_MAXLEN } from '@/lib/constants/idc';
import { borderColors, cn, inputStyles, textColors } from '@/lib/theme';

interface IdcExclusionReasonModalProps {
  isOpen: boolean;
  /** Prefill when editing an existing custom reason. */
  initialReason?: string;
  /** Saved a non-empty reason. */
  onSave: (reason: string) => void;
  /** Closed without saving — parent reverts the check if no reason exists yet. */
  onClose: () => void;
}

/**
 * Free-text exclusion reason (≤200 chars, char counter). 저장 requires a
 * non-empty value; closing without saving reverts via `onClose`
 * (v15 idcReasonModal / saveIdcReason).
 */
export const IdcExclusionReasonModal = ({
  isOpen,
  initialReason = '',
  onSave,
  onClose,
}: IdcExclusionReasonModalProps) => {
  const [text, setText] = useState(initialReason);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => textareaRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [isOpen]);

  const trimmed = text.trim();
  const canSave = trimmed !== '';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="제외 사유 직접 입력"
      subtitle="이 DB를 연동 대상에서 제외하는 이유를 입력해주세요. 관리자 승인 시 함께 전달돼요."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" disabled={!canSave} onClick={() => onSave(trimmed)}>
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          maxLength={IDC_REASON_MAXLEN}
          rows={4}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: Stg 환경 DB이며 운영 데이터가 아닌 익명화된 샘플 데이터만 보관하고 있어 제외합니다."
          className={cn(inputStyles.base, 'resize-none border', borderColors.default, 'text-[13.5px] leading-[1.6]')}
        />
        <div className={cn('text-right text-[11.5px]', textColors.quaternary)}>
          {text.length}/{IDC_REASON_MAXLEN}자
        </div>
      </div>
    </Modal>
  );
};
