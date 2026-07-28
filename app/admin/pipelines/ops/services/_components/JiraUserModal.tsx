'use client';

/**
 * Jira Ticket 알림 사용자 등록 modal (design/pipeline/admin-ops.html
 * openJiraUserModal) — 이름/사번 1건 등록. 등록된 사용자는 chips로 보여준다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { addJiraTicketUser, type OpsJiraTicket } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-user-title';
const INPUT_ID = 'ops-jira-user-input';

export interface JiraUserModalProps {
  open: boolean;
  onClose: () => void;
  serviceCode: string;
  ticket: OpsJiraTicket;
  /** 등록 성공 — 상세를 다시 읽는다. */
  onDone: () => void;
}

export function JiraUserModal({
  open,
  onClose,
  serviceCode,
  ticket,
  onDone,
}: JiraUserModalProps): ReactElement | null {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUserId('');
      setError(null);
    }
  }, [open, ticket.ticket_key]);

  const submit = async (): Promise<void> => {
    const value = userId.trim();
    if (!value) {
      setError('이름 또는 사번을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await addJiraTicketUser(serviceCode, ticket.ticket_key, value);
      onDone();
      onClose();
    } catch (err) {
      setError(
        err instanceof AppError && err.isUserFacing
          ? err.message
          : '등록에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        User 등록: <span className={pipelineStyles.text.mono}>{ticket.ticket_key}</span>
      </h3>
      <p className={pipelineStyles.modal.desc}>
        티켓 상태 변경 알림을 받을 사용자를 등록합니다.
      </p>

      <label htmlFor={INPUT_ID} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
        사용자
      </label>
      <SearchBox
        id={INPUT_ID}
        wrapClassName="mt-2 block"
        placeholder="이름 또는 사번"
        autoComplete="off"
        value={userId}
        onChange={(event) => setUserId(event.target.value)}
      />

      {ticket.users.length > 0 && (
        <>
          <p className={cn(pipelineStyles.text.subsectionTitle, 'mt-3.5')}>등록된 사용자</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ticket.users.map((user) => (
              <span key={user} className={opsStyles.tag}>
                {user}
              </span>
            ))}
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-[var(--pl-err-text)]">
          {error}
        </p>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={submitting}>
          취소
        </PlButton>
        <PlButton variant="primary" onClick={() => void submit()} disabled={submitting}>
          {submitting ? '등록 중…' : '등록'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
