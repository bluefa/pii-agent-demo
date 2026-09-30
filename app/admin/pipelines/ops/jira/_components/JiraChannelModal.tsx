'use client';

/**
 * 협업 채널 모달 — 표의 한 행이 여는 창.
 *
 * 티켓 버킷: Jira 에서 만든 티켓의 이슈 키를 연결한다(관리자가 할 수 있는 유일한 동작 —
 * 만드는 API 는 없다). Watcher 버킷: 등록은 Jira 에서 직접 하므로 추가할 사용자 표와
 * 티켓 링크만 준다.
 *
 * 연결 뒤에는 `router.refresh()` 가 목록을 다시 읽는다 — 같은 서비스 + 클라우드의 행은
 * 그때 서버가 뺀다. 클라이언트에서 목록을 고치지 않는다.
 */
import { useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { AppError } from '@/lib/errors';
import { safeBrowseUrl } from '@/lib/jira-ticket';
import { displayProvider, providerLabel } from '@/lib/pipeline/format';
import type { JiraAlertKind } from '@/lib/types/task-queue';
import { nextAttemptClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import { worklist } from '@/app/admin/pipelines/ops/alerts/_components/worklistStyles';
import { ChannelTag } from '@/app/admin/pipelines/ops/jira/_components/ChannelTag';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { getCollaborationChannel, putCollaborationChannel } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-channel-title';
const INPUT_ID = 'ops-jira-channel-issue-key';
const ERROR_ID = 'ops-jira-channel-error';

const styles = {
  title: 'mb-3 text-[20px] font-bold leading-[1.25] text-[var(--pl-text-strong)]',
  /** 머리띠 — 어느 대상인지 한 줄. */
  strip: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[var(--pl-text-medium)]',
  stripId: 'font-semibold tabular-nums text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** 상태 줄 — 태그 + 12px 보조 줄. */
  status: 'mt-4 flex flex-col items-start gap-1',
  subLine: 'text-[12px] text-[var(--pl-text-weak)]',
  link: 'inline-flex items-center gap-1 text-[12px] font-medium text-[var(--pl-info-text)] hover:underline',
  emphasis: 'font-semibold text-[var(--pl-text-strong)]',
  body: 'mt-4',
  error: 'mt-2 text-[12px] font-medium text-[var(--pl-err-text)]',
  banner: 'mt-3 flex items-start justify-between gap-3 rounded-lg border px-3.5 py-3 text-[14px] leading-[1.6]',
  bannerWarn: 'border-[var(--pl-warn-text)] bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]',
  bannerInfo: 'border-[var(--pl-info-text)] bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]',
  /** Watcher 표 — 작은 4열. */
  table: 'mt-3 w-full table-fixed text-[14px]',
  th: 'h-8 px-2 text-left text-[12px] font-semibold text-[var(--pl-text-medium)] border-b border-[var(--pl-border)]',
  td: 'h-9 px-2 text-[var(--pl-text-strong)] border-b border-[var(--pl-gray-100)]',
  copy: 'inline-flex h-7 items-center gap-1 rounded border border-[var(--pl-border-strong)] px-2 text-[12px] font-medium text-[var(--pl-text-medium)] hover:bg-[var(--pl-gray-50)]',
} as const;

const WATCHER_STATUS_COPY: Record<string, string> = {
  FAILED: '등록 실패',
  RETRYING: '재시도 중',
  PENDING: '등록 대기',
};

type Banner = { tone: 'warn' | 'info'; text: string; refetch: boolean } | null;

function TicketLink({ channel }: { channel: CollaborationChannel }): ReactElement | null {
  if (!channel.issueKey) return null;
  const href = safeBrowseUrl(channel.url);
  return href ? (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer">
      {channel.issueKey}
      <Icon name="arrow-ur" size={12} />
    </a>
  ) : (
    <span className={cn(styles.subLine, worklist.codeText)}>{channel.issueKey}</span>
  );
}

/** 상태 줄의 보조 줄 — 상태마다 다른 사실 하나. */
function StatusSubLine({ channel }: { channel: CollaborationChannel | null }): ReactElement | null {
  if (!channel) return null;
  if (channel.status === 'RETRYING') {
    const clock = nextAttemptClock(channel.nextAttemptAt);
    return clock ? <span className={styles.subLine}>다음 시도 {clock}</span> : null;
  }
  if (channel.status === 'FAILED') {
    return channel.maxAttempts != null ? (
      <span className={styles.subLine}>{channel.maxAttempts}회 모두 실패</span>
    ) : null;
  }
  if (channel.status === 'CREATED') return <TicketLink channel={channel} />;
  return null;
}

export function JiraChannelModal({
  kind,
  row,
  onClose,
}: {
  kind: JiraAlertKind;
  row: JiraWorklistRow;
  onClose: () => void;
}): ReactElement {
  const router = useRouter();
  const toast = usePlToast();
  const refreshCounts = useNavCountsRefresh();
  const [channel, setChannel] = useState<CollaborationChannel | null>(row.channel);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [busy, setBusy] = useState(false);

  const id = row.targetSourceId;
  const provider = providerLabel(displayProvider(row.cloudProvider, row.isSduType));
  const linked = channel?.status === 'CREATED' && !!channel.issueKey;

  const refetch = async () => {
    if (id == null) return;
    setBusy(true);
    try {
      setChannel(await getCollaborationChannel(id));
      setBanner(null);
    } catch {
      setChannel(null);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    const issueKey = value.trim();
    if (!issueKey) {
      setError('이슈 키를 입력해 주세요.');
      return;
    }
    if (id == null) return;
    setError(null);
    setBanner(null);
    setBusy(true);
    try {
      await putCollaborationChannel(id, issueKey);
      toast.show(`${issueKey} 를 협업 채널로 연결했어요`);
      onClose();
      router.refresh();
      refreshCounts();
    } catch (err) {
      if (err instanceof AppError && err.rawCode === 'JIRA_TICKET_CREATION_IN_PROGRESS') {
        setBanner({ tone: 'warn', text: '자동 생성이 진행 중입니다. 잠시 후 다시 시도해 주세요.', refetch: true });
      } else if (err instanceof AppError && err.status === 409) {
        setBanner({ tone: 'info', text: '그 사이 다른 경로에서 먼저 연결됐습니다. 현재 값을 다시 불러왔어요.', refetch: false });
        try {
          setChannel(await getCollaborationChannel(id));
        } catch {
          setChannel(null);
        }
      } else {
        setError(userErrorText(err, '연결에 실패했어요. 잠시 후 다시 시도해 주세요.'));
      }
    } finally {
      setBusy(false);
    }
  };

  const copyUsername = async (username: string) => {
    await navigator.clipboard.writeText(username);
    toast.show(`${username} 을 복사했어요`);
  };

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={styles.title}>
        {kind === 'jira-ticket-failed' ? '티켓 연결' : 'Watcher 등록 실패'}
      </h3>

      <div className={styles.strip}>
        <ProvTag provider={row.cloudProvider ?? ''} isSdu={row.isSduType} />
        <span className={styles.stripId}>Target {id ?? '—'}</span>
        <span>
          {row.serviceCode ?? '—'} · {row.serviceName ?? '—'}
          {row.description ? ` · ${row.description}` : ''}
        </span>
      </div>

      <div className={styles.status}>
        <ChannelTag channel={channel} />
        <StatusSubLine channel={channel} />
      </div>

      {kind === 'jira-ticket-failed' ? (
        <div className={styles.body}>
          <p className={pipelineStyles.modal.desc}>
            Jira 에서 티켓을 만든 뒤 이슈 키를 연결합니다. 티켓은 서비스 + 클라우드 단위로 하나라,{' '}
            <span className={styles.emphasis}>{row.serviceCode ?? '—'}</span> 서비스의{' '}
            <span className={styles.emphasis}>{provider}</span> Target Source 전체에 같은 티켓이
            연결됩니다.
          </p>
          {linked ? null : (
            <>
              <label htmlFor={INPUT_ID} className={cn(pipelineStyles.text.subsectionTitle, 'block')}>
                Jira 이슈 키
              </label>
              <input
                id={INPUT_ID}
                type="text"
                className={opsStyles.credModal.search}
                placeholder="예: BDCDIP-1234"
                autoComplete="off"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? ERROR_ID : undefined}
              />
              {error ? (
                <p id={ERROR_ID} role="alert" className={styles.error}>
                  {error}
                </p>
              ) : null}
            </>
          )}
          {banner ? (
            <div role="status" className={cn(styles.banner, banner.tone === 'warn' ? styles.bannerWarn : styles.bannerInfo)}>
              <span>{banner.text}</span>
              {banner.refetch ? (
                <PlButton variant="secondary" size="sm" onClick={() => void refetch()} disabled={busy}>
                  다시 조회
                </PlButton>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.body}>
          <p className={pipelineStyles.modal.desc}>
            watcher 등록은 Jira 에서 직접 합니다. 티켓을 열어 아래 사용자를 watcher 로 추가해 주세요.
          </p>
          {row.failedWatchers ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>사용자</th>
                  <th className={cn(styles.th, 'w-[96px]')}>상태</th>
                  <th className={cn(styles.th, 'w-[64px]')}>시도</th>
                  <th className={cn(styles.th, 'w-[80px]')} />
                </tr>
              </thead>
              <tbody>
                {row.failedWatchers.map((watcher) => (
                  <tr key={watcher.username}>
                    <td className={cn(styles.td, worklist.codeText)}>{watcher.username}</td>
                    <td className={styles.td}>
                      {watcher.status ? (WATCHER_STATUS_COPY[watcher.status] ?? watcher.status) : '—'}
                    </td>
                    <td className={cn(styles.td, 'tabular-nums')}>{watcher.attemptCount ?? '—'}</td>
                    <td className={cn(styles.td, 'text-right')}>
                      <button type="button" className={styles.copy} onClick={() => void copyUsername(watcher.username)}>
                        복사
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={styles.subLine}>추가할 사용자를 응답에서 읽지 못했어요.</p>
          )}
          {/* The ticket link already stands on the status line above (CREATED → key ↗); a
              second copy under the table would be the same link twice in one 480px modal. */}
        </div>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={busy}>
          닫기
        </PlButton>
        {kind === 'jira-ticket-failed' && !linked ? (
          <PlButton variant="primary" onClick={() => void submit()} disabled={busy}>
            {busy ? '처리 중…' : '티켓 연결'}
          </PlButton>
        ) : null}
      </div>
    </ModalShell>
  );
}
