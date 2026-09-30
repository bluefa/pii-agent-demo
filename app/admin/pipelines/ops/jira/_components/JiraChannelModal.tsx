'use client';

/**
 * 협업 채널 모달 — 표의 한 행이 여는 창 (오너 2026-09-30: 720px 로 넓혀 여유를 둔다).
 *
 * 위에서 아래로: 제목 줄(제목 + Cloud 태그) · 정체성 한 줄 · 사실 띠(상태·횟수·시각을
 * `fmCell` 문법의 4열로) · 섹션(제목 + 설명 + 동작 또는 표) · [닫기].
 *
 * 티켓 버킷은 생성을 한 번 더 요청한다(`RetryPanel`) — 이슈 키를 손으로 연결하는 길은
 * 이 콘솔에 없다(오너: "attach 는 없애줘"; 서비스 운영 화면의 연결이 그 길이다).
 * Watcher 버킷은 실패한 사용자를 다시 등록한다(`WatcherPanel`).
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { safeBrowseUrl } from '@/lib/jira-ticket';
import type { JiraAlertKind } from '@/lib/types/task-queue';
import { WATCHER_PAGE_SIZE, localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { ChannelTag } from '@/app/admin/pipelines/ops/jira/_components/ChannelTag';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { RetryPanel } from '@/app/admin/pipelines/ops/jira/_components/RetryPanel';
import { WatcherPanel } from '@/app/admin/pipelines/ops/jira/_components/WatcherPanel';
import { getCollaborationChannel } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-channel-title';

const styles = {
  /** `wide` 는 폭만 정한다 — 높이 상한과 본문 스크롤은 여기서 단다. */
  shell: 'max-h-[min(760px,88vh)]',
  titleRow: 'flex items-center justify-between gap-4',
  title: 'text-[20px] font-bold leading-[1.25] text-[var(--pl-text-strong)]',
  identity: 'mt-1 truncate text-[14px] leading-[1.4] text-[var(--pl-text-medium)]',
  identityId: 'font-semibold tabular-nums text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** 사실 띠 — 운영 화면 머리(`fmCell`)와 같은 문법: 라벨 위, 값 아래. */
  band: 'mt-5 rounded-[8px] border border-[var(--pl-border)] bg-[var(--pl-bg-inner)] px-5 py-4',
  bandGrid: 'grid grid-cols-4 gap-x-[18px]',
  link: 'inline-flex min-w-0 items-center gap-1 text-[var(--pl-info-text)] hover:underline',
  body: 'mt-6',
} as const;

/** 이슈 키 — 주소가 http(s) 면 링크 ↗, 아니면 글자. */
export function TicketLink({ channel }: { channel: CollaborationChannel }): ReactElement | null {
  if (!channel.issueKey) return null;
  const href = safeBrowseUrl(channel.url);
  return href ? (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer">
      <span className={opsStyles.fmValueText}>{channel.issueKey}</span>
      <Icon name="arrow-ur" size={14} />
    </a>
  ) : (
    <span className={opsStyles.fmValueText}>{channel.issueKey}</span>
  );
}

function Fact({ label, children }: { label: string; children: ReactElement | string }): ReactElement {
  return (
    <div className={opsStyles.fmCell}>
      <span className={opsStyles.fmKey}>{label}</span>
      <span className={opsStyles.fmValue}>{children}</span>
    </div>
  );
}

/** 사실 띠의 칸들 — 버킷과 상태가 정한다. 없는 값은 `—`. */
function Facts({ kind, channel }: { kind: JiraAlertKind; channel: CollaborationChannel | null }): ReactElement {
  if (!channel) {
    return (
      <Fact label="상태">
        <ChannelTag channel={null} />
      </Fact>
    );
  }
  if (kind === 'jira-watcher-failed') {
    const next = channel.failedWatchers
      .map((w) => w.nextAttemptAt)
      .filter((at): at is string => at !== null)
      .sort()[0];
    return (
      <>
        <Fact label="티켓">{channel.issueKey ? <TicketLink channel={channel} /> : '—'}</Fact>
        <Fact label="상태">
          <ChannelTag channel={channel} />
        </Fact>
        <Fact label="등록 실패">{`${channel.failedWatchersTotal}명`}</Fact>
        <Fact label="다음 시도">{localClock(next ?? null) ?? '—'}</Fact>
      </>
    );
  }
  if (channel.status === 'CREATED') {
    return (
      <>
        <Fact label="상태">
          <ChannelTag channel={channel} />
        </Fact>
        <Fact label="티켓">{channel.issueKey ? <TicketLink channel={channel} /> : '—'}</Fact>
      </>
    );
  }
  return (
    <>
      <Fact label="상태">
        <ChannelTag channel={channel} />
      </Fact>
      <Fact label="실패 횟수">
        {channel.attemptCount != null && channel.attemptCount > 0 ? `${channel.attemptCount}회` : '—'}
      </Fact>
      <Fact label="다음 시도">{localClock(channel.nextAttemptAt) ?? '—'}</Fact>
      <Fact label={channel.status === 'FAILED' ? '자동 재시도 종료' : '자동 재시도 종료 예정'}>
        {localClock(channel.retryExpiresAt) ?? '—'}
      </Fact>
    </>
  );
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
  const [channel, setChannel] = useState<CollaborationChannel | null>(row.channel);
  const [busy, setBusy] = useState(false);
  const id = row.targetSourceId;

  /** 채널을 다시 읽는다 — 못 읽으면 null(조회 실패), 지어내지 않는다. */
  const reload = async (watcherPage?: number): Promise<void> => {
    if (id == null) return;
    setBusy(true);
    try {
      setChannel(
        await getCollaborationChannel(id, {
          watcherSize: WATCHER_PAGE_SIZE,
          ...(watcherPage != null ? { watcherPage } : {}),
        }),
      );
    } catch {
      setChannel(null);
    } finally {
      setBusy(false);
    }
  };

  const identity = [row.serviceCode, row.serviceName].filter(Boolean).join(' ');

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID} variant="wide" className={styles.shell}>
      <div className={styles.titleRow}>
        <h3 id={TITLE_ID} className={styles.title}>
          {kind === 'jira-ticket-failed' ? '티켓 다시 생성' : 'Watcher 등록 실패'}
        </h3>
        <ProvTag provider={row.cloudProvider ?? ''} isSdu={row.isSduType} isChina={row.isChinaRegion} size="lg" />
      </div>
      <p className={styles.identity} title={row.description ?? undefined}>
        <span className={styles.identityId}>Target {id ?? '—'}</span>
        {identity ? ` · ${identity}` : ''}
        {row.description ? ` · ${row.description}` : ''}
      </p>

      <div className={styles.band} data-testid="facts-band">
        <div className={styles.bandGrid}>
          <Facts kind={kind} channel={channel} />
        </div>
      </div>

      <div className={cn(styles.body, pipelineStyles.modal.body)}>
        {kind === 'jira-ticket-failed' ? (
          <RetryPanel id={id} channel={channel} busy={busy} reload={reload} />
        ) : (
          <WatcherPanel row={row} channel={channel} busy={busy} reload={reload} />
        )}
      </div>

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={busy}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
