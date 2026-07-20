/**
 * RejectModal — 연동 요청 반려 (design-spec §6). TqModal chrome + a required
 * 반려 사유 textarea (max 1,024 + CharCount); the 반려 dangerSolid CTA is disabled
 * until the reason is non-blank. The reason is relayed verbatim to the owner.
 */
'use client';

import { useState, type ReactElement } from 'react';
import { TqModal } from '@/app/admin/pipelines/queue/_components/TqModal';
import { CharCount } from '@/app/admin/pipelines/queue/_components/bits';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';

const MAX = 1024;

export interface RejectModalProps {
  open: boolean;
  onClose: () => void;
  targetSourceId: number;
  serviceName: string;
  onSubmit: (reason: string) => Promise<void>;
}

export function RejectModal({
  open,
  onClose,
  targetSourceId,
  serviceName,
  onSubmit,
}: RejectModalProps): ReactElement {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { modal } = tqStyles;
  const canSubmit = reason.trim().length > 0 && !submitting;

  const submit = async (): Promise<void> => {
    setSubmitting(true);
    try {
      await onSubmit(reason.slice(0, MAX));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TqModal
      open={open}
      onClose={onClose}
      eyebrowCtx="연동 요청"
      eyebrowId={`#${targetSourceId}`}
      title="연동 요청 반려"
      sub={`${serviceName}의 요청을 반려해요. 사유는 서비스 오너에게 그대로 전달돼요.`}
      footer={
        <>
          <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </PlButton>
          <PlButton variant="dangerSolid" onClick={submit} disabled={!canSubmit}>
            반려
          </PlButton>
        </>
      }
    >
      <div className={modal.label}>반려 사유 · 필수</div>
      <textarea
        className={modal.textarea}
        maxLength={MAX}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="서비스 오너가 무엇을 고쳐 다시 요청해야 하는지 적어 주세요"
      />
      <CharCount count={reason.length} max={MAX} />
    </TqModal>
  );
}
