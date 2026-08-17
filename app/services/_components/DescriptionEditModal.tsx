'use client';

import { useRef, useState } from 'react';

import { ConfirmStepModal } from '@/app/components/ui/ConfirmStepModal';
import { updateTargetSourceDescription } from '@/app/lib/api';
import { cn, idcStyles, statusColors, textColors } from '@/lib/theme';

interface DescriptionEditModalProps {
  targetSourceId: number;
  /** The row's current 설명 — empty when the target has none yet. */
  initialDescription: string;
  /** Saved — the parent reloads the list, which is where the row's text comes from. */
  onSaved: () => void;
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
 * No character counter and no maxLength: the contract declares neither, and a cap we
 * invented here would be the screen telling the user a rule the server does not have.
 * The gate is "different from what is already saved" — a fact this screen does own —
 * which also keeps a no-op PUT from being sent.
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
      onSaved();
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
          rows={3}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: Azure SQL, PostgreSQL, MySQL 리소스에 PII Agent 설치"
          className={idcStyles.textarea}
          aria-label="설명"
        />
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
      </div>
    </ConfirmStepModal>
  );
};
