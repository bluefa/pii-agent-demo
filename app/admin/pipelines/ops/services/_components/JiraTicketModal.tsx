'use client';

/**
 * Jira Ticket 연결 / 연결 해제 modal — CloudProvider 가 키다.
 *
 * 두 동작 모두 "서비스 ↔ 티켓 매핑"만 바꾸고 Jira 의 티켓 자체는 건드리지 않는다
 * (docs/api/jira-tickets.md §1). 해제가 되돌릴 수 있는 작업이라는 사실이 문구와
 * 버튼 톤 양쪽에 드러나야 한다 — EOS 처럼 dangerSolid 로 겁주지 않는다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { providerLabel } from '@/lib/pipeline/format';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import {
  attachJiraTicket,
  detachJiraTicket,
  type JiraCloudProvider,
} from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-ticket-title';
const INPUT_ID = 'ops-jira-issue-key';

export interface JiraTicketModalProps {
  onClose: () => void;
  serviceCode: string;
  provider: JiraCloudProvider;
  /** 연결된 티켓 키 — 있으면 해제, 없으면 연결. */
  issueKey: string | null;
  /** 성공 — 티켓 목록을 다시 읽는다. */
  onDone: () => void;
}

export function JiraTicketModal({
  onClose,
  serviceCode,
  provider,
  issueKey,
  onDone,
}: JiraTicketModalProps): ReactElement {
  const detaching = issueKey !== null;
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setValue('');
    setError(null);
  }, [provider, issueKey]);

  const submit = async (): Promise<void> => {
    const trimmed = value.trim();
    if (!detaching && !trimmed) {
      setError('Jira 티켓 키를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (detaching) await detachJiraTicket(serviceCode, provider);
      else await attachJiraTicket(serviceCode, provider, trimmed);
      onDone();
      onClose();
    } catch (err) {
      setError(
        err instanceof AppError && err.isUserFacing
          ? err.message
          : `${detaching ? '연결 해제' : '연결'}에 실패했습니다. 잠시 후 다시 시도해 주세요.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        {detaching ? 'Jira Ticket 연결 해제' : 'Jira Ticket 연결'}: {providerLabel(provider)}
      </h3>
      <p className={pipelineStyles.modal.desc}>
        {detaching ? (
          <>
            <span className={pipelineStyles.text.mono}>{issueKey}</span> 와(과) {serviceCode} ·{' '}
            {providerLabel(provider)} 의 연결을 끊습니다.
          </>
        ) : (
          <>
            이미 만들어져 있는 Jira 티켓을 {serviceCode} · {providerLabel(provider)} 에 연결합니다.
            티켓을 새로 만들지는 않습니다.
          </>
        )}
      </p>

      {detaching ? (
        // 되돌릴 수 있다는 사실이 핵심 — 경고(err)가 아니라 정보(info) 톤.
        <div className="flex items-start gap-2 rounded-lg border border-[var(--pl-border)] bg-[var(--pl-gray-50)] px-3.5 py-3 text-[13px] leading-[1.6] text-[var(--pl-text-medium)]">
          <span className="mt-0.5 flex-none text-[var(--pl-text-weak)]">
            <Icon name="info" size="sm" />
          </span>
          <span>
            <b className="font-semibold text-[var(--pl-text-strong)]">
              Jira 의 티켓은 삭제되지 않습니다.
            </b>{' '}
            이 화면의 연결 정보만 지워지며, 티켓과 그 이력은 Jira 에 그대로 남습니다. 같은 키를 다시
            연결하면 원래대로 돌아갑니다.
          </span>
        </div>
      ) : (
        <>
          <label htmlFor={INPUT_ID} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
            Jira 티켓 키
          </label>
          <SearchBox
            id={INPUT_ID}
            wrapClassName="mt-2 block"
            placeholder="예: INFRA-2211"
            autoComplete="off"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
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
        <PlButton
          variant={detaching ? 'danger' : 'primary'}
          onClick={() => void submit()}
          disabled={submitting}
        >
          {submitting ? '처리 중…' : detaching ? '연결 해제' : '연결'}
        </PlButton>
      </div>
    </ModalShell>
  );
}
