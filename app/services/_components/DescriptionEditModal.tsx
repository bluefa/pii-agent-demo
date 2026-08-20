'use client';

import { useRef, useState } from 'react';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { updateTargetSourceDescription } from '@/app/lib/api';
import { cn, idcStyles, statusColors, textColors } from '@/lib/theme';

/** ASSUMED contract (docs/api/ops-assumed-contracts.md §8) description 의 maxLength. */
const DESCRIPTION_MAXLEN = 1000;

interface DescriptionEditModalProps {
  targetSourceId: number;
  /** The row's current 설명 — empty when the target has none yet. */
  initialDescription: string;
  /** Saved — receives the value that was written, so a caller holding local state
      (ops rail) can update in place; the /pass/services caller reloads instead. */
  onSaved: (saved: string) => void;
  onClose: () => void;
}

/**
 * 설명 수정 — the writer for `TargetSourceDetail.description`, opened from the row's
 * ⋮ menu on /pass/services.
 *
 * Built on ConfirmStepModal like the other input-carrying confirms (IdcExclusionReasonModal),
 * so it inherits the 480px card, the focus trap and the footer pair rather than growing
 * a second dialog system next to them.
 *
 * The 1,000-character cap is the contract's (assumed §8), so the screen states it: `maxLength`
 * on the textarea plus the same two-tone counter 초기화 사유 uses, and the route guards the
 * boundary independently. The save gate stays "different from what is already saved", which
 * also keeps a no-op PUT from being sent.
 *
 * A failure keeps the dialog open with the typed text intact; closing on error would
 * make the user retype what they just lost.
 */
export const DescriptionEditModal = ({
  targetSourceId,
  initialDescription,
  onSaved,
  onClose,
}: DescriptionEditModalProps) => {
  const [text, setText] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmed = text.trim();
  const changed = trimmed !== initialDescription.trim();

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateTargetSourceDescription(targetSourceId, trimmed);
      onSaved(trimmed);
    } catch {
      // 업스트림 message 를 그대로 싣지 않는다 — 게이트웨이 원문은 사용자의 판단에
      // 아무것도 보태지 못한다. "잠시 후 다시" 라고도 하지 않는다: 이 엔드포인트는
      // 아직 계약이 없어(assumed §8) 실서버에서는 404 가 영구적이고, 그 문구는
      // 될 리 없는 재시도를 권한다. 재시도는 열어 두되 약속하지는 않는다.
      setError('설명을 저장하지 못했습니다. 문제가 계속되면 담당자에게 알려 주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ConfirmStepModal
      open
      onClose={onClose}
      onConfirm={() => void save()}
      title="설명 수정"
      description="이 연동 대상이 무엇인지 한 줄로 적어 두면 목록에서 계정을 구분하기 쉬워요."
      confirmLabel="저장"
      cancelLabel="취소"
      isPending={saving}
      confirmDisabled={!changed}
      initialFocus={textareaRef}
    >
      <div className="space-y-1.5">
        <textarea
          ref={textareaRef}
          value={text}
          maxLength={DESCRIPTION_MAXLEN}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치"
          className={idcStyles.textarea}
          aria-label="설명"
        />
        <div className="flex items-start justify-between gap-3">
          {error ? (
            <p className={cn('text-[14px]', statusColors.error.textDark)} role="alert">
              {error}
            </p>
          ) : (
            // 비우고 저장하면 설명이 사라진다는 것을 미리 말한다 — 빈 입력이 유효한 값인
            // 화면에서, 그 사실은 저장을 누른 뒤에 알게 되면 늦다.
            <p className={cn('text-[12px]', textColors.tertiary)}>
              비워 두고 저장하면 설명이 지워집니다.
            </p>
          )}
          {/* 두 톤 카운터 (ConfirmRewindModal 과 같은 형태) — 변하는 수만 진하게, 고정
              분모는 흐리게. 한도에 닿으면 현재 길이가 error 색으로 바뀌어 "왜 더 안
              쳐지는지"를 말한다. */}
          <div className="shrink-0 text-right text-[12px] tabular-nums">
            <span
              className={cn(
                'font-semibold',
                text.length >= DESCRIPTION_MAXLEN ? statusColors.error.text : textColors.secondary,
              )}
            >
              {text.length.toLocaleString()}
            </span>
            <span className={textColors.tertiary}> / {DESCRIPTION_MAXLEN.toLocaleString()}자</span>
          </div>
        </div>
      </div>
    </ConfirmStepModal>
  );
};
