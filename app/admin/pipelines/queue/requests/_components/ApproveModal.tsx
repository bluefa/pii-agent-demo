/**
 * ApproveModal — 연동 요청 승인 (design-spec §6). TqModal chrome + an optional
 * unsaved-NLB warn note, a 관리자 메시지 (선택) textarea (max 1,024 + CharCount),
 * and a 승인 primary CTA. The comment is optional, so 승인 is always enabled.
 */
'use client';

import { useState, type ReactElement } from 'react';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { CharCount } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

const MAX = 1024;

export interface ApproveModalProps {
  open: boolean;
  onClose: () => void;
  serviceName: string;
  selectedCount: number | null;
  onSubmit: (comment: string) => Promise<void>;
}

export function ApproveModal({
  open,
  onClose,
  serviceName,
  selectedCount,
  onSubmit,
}: ApproveModalProps): ReactElement {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { modal } = tqStyles;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(comment.slice(0, MAX));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      title="연동 요청 승인"
      sub={`${serviceName}의 선택 리소스 ${selectedCount ?? 0}건을 승인해요. 승인하면 연동 대상 반영이 시작돼요.`}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="primary" onClick={submit} disabled={submitting}>
            승인
          </PlButton>
        </>
      }
    >
      <div className={modal.label}>관리자 메시지 · 선택</div>
      <textarea
        className={modal.textarea}
        maxLength={MAX}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="서비스 오너에게 전달할 메시지를 남길 수 있어요"
      />
      <CharCount count={comment.length} max={MAX} />
    </TqModal>
  );
}
