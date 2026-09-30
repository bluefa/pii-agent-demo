'use client';

/**
 * 협업 채널 모달 — 표의 한 행이 여는 창 (오너 2026-09-30: 720px, 여백으로 블록을 가른다).
 *
 * 위에서 아래로 `gap-6` 으로 선 블록들: 머리(제목 22 + 한 줄 설명 + X) · 대상 카드(주인공:
 * Cloud 태그 + 설명 16/600, `Target N · CODE 이름`, 오른쪽에 상태 태그) · 사실 세 칸(헤어라인) ·
 * 동작(티켓: 요청 띠 + 배너 `RetryPanel` / watcher: 사용자 표 `WatcherPanel`) · 바닥 [닫기].
 *
 * 티켓 버킷의 동작은 생성 재요청 하나다 — 이슈 키를 손으로 연결하는 길은 이 콘솔에 없다
 * (오너 "attach 는 없애줘"; 서비스 운영 화면의 연결이 그 길이다).
 */
import { useState, type ReactElement, type ReactNode } from 'react';

import { safeBrowseUrl } from '@/lib/jira-ticket';
import type { JiraAlertKind } from '@/lib/types/task-queue';
import { WATCHER_PAGE_SIZE, localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { jobStyles } from '@/app/admin/pipelines/_detail/detailJobStyles';
import { ChannelTag } from '@/app/admin/pipelines/ops/jira/_components/ChannelTag';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { RetryPanel } from '@/app/admin/pipelines/ops/jira/_components/RetryPanel';
import { WatcherPanel } from '@/app/admin/pipelines/ops/jira/_components/WatcherPanel';
import { getCollaborationChannel } from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-channel-title';

const styles = {
  /** `wide` 는 폭만 정한다 — 높이 상한·여백(28 옆·위, 24 아래)·블록 간격은 여기서 단다. */
  shell: 'max-h-[min(760px,88vh)] px-7! pt-7! pb-6! flex flex-col gap-6',
  head: 'flex items-start justify-between gap-4',
  title: 'text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-[var(--pl-text-strong)]',
  lead: 'mt-1.5 text-[14px] leading-[1.4] text-[var(--pl-text-weak)]',
  /** 대상 카드 — 이 창의 주인공. */
  card: 'flex items-center justify-between gap-4 rounded-[10px] border border-[var(--pl-border)] bg-[var(--pl-bg-inner)] px-5 py-4',
  cardMain: 'min-w-0',
  cardLine1: 'flex min-w-0 items-center gap-3',
  cardDesc: 'min-w-0 truncate text-[16px] font-semibold leading-[1.4] text-[var(--pl-text-strong)]',
  cardLine2: 'mt-1 truncate text-[14px] leading-[1.4] text-[var(--pl-text-weak)] tabular-nums',
  cardStrong: 'font-semibold text-[var(--pl-text-medium)]',
  /** 사실 세 칸 — 라벨 위, 값 아래, 칸 사이는 헤어라인. */
  facts: 'grid grid-cols-3',
  fact: 'flex min-w-0 flex-col gap-1 border-l border-[var(--pl-gray-200)] px-5 first:border-l-0 first:pl-0',
  factKey: 'truncate text-[12px] font-medium leading-4 text-[var(--pl-gray-600)]',
  factValue: 'flex min-h-[24px] min-w-0 items-center text-[16px] font-semibold leading-[1.4] tabular-nums text-[var(--pl-text-strong)]',
  // weak, not faint: faint (#98A2B3) is 2.58:1 on white and the design gate refuses it on a light surface.
  factNone: 'font-medium text-[var(--pl-text-weak)]',
  link: 'inline-flex min-w-0 items-center gap-1 text-[var(--pl-primary)] hover:underline',
  linkText: 'min-w-0 truncate',
  /** 동작 블록은 본문 스크롤을 갖는다 — 표와 배너가 길어져도 머리·카드는 선다. */
  body: 'min-h-0 overflow-y-auto',
  foot: 'flex justify-end gap-2 border-t border-[var(--pl-gray-200)] pt-4',
} as const;

/** 이슈 키 — 주소가 http(s) 면 링크 ↗, 아니면 글자. */
export function TicketLink({ channel }: { channel: CollaborationChannel }): ReactElement | null {
  if (!channel.issueKey) return null;
  const href = safeBrowseUrl(channel.url);
  return href ? (
    <a className={styles.link} href={href} target="_blank" rel="noreferrer">
      <span className={styles.linkText}>{channel.issueKey}</span>
      <Icon name="arrow-ur" size={14} />
    </a>
  ) : (
    <span className={styles.linkText}>{channel.issueKey}</span>
  );
}

/** 값이 없어도 칸은 남는다 — `—` 를 흐리게. */
function Fact({ label, children }: { label: string; children?: ReactNode }): ReactElement {
  return (
    <div className={styles.fact}>
      <span className={styles.factKey}>{label}</span>
      <span className={styles.factValue}>
        {children ?? <span className={styles.factNone}>—</span>}
      </span>
    </div>
  );
}

const orNone = (value: string | null): ReactNode => value ?? undefined;

function Facts({ kind, channel }: { kind: JiraAlertKind; channel: CollaborationChannel | null }): ReactElement {
  if (kind === 'jira-watcher-failed') {
    const earliest = (channel?.failedWatchers ?? [])
      .map((w) => w.nextAttemptAt)
      .filter((at): at is string => at !== null)
      .sort()[0];
    return (
      <>
        <Fact label="티켓">{channel?.issueKey ? <TicketLink channel={channel} /> : undefined}</Fact>
        <Fact label="등록 실패">{channel ? `${channel.failedWatchersTotal}명` : undefined}</Fact>
        <Fact label="가장 빠른 다음 시도">{orNone(localClock(earliest ?? null))}</Fact>
      </>
    );
  }
  if (channel?.status === 'CREATED') {
    return (
      <>
        <Fact label="티켓">{channel.issueKey ? <TicketLink channel={channel} /> : undefined}</Fact>
        <Fact label="실패 횟수" />
        <Fact label="다음 시도" />
      </>
    );
  }
  const attempts = channel?.attemptCount != null && channel.attemptCount > 0 ? `${channel.attemptCount}회` : null;
  return (
    <>
      <Fact label="실패 횟수">{orNone(attempts)}</Fact>
      <Fact label="다음 시도">{orNone(localClock(channel?.nextAttemptAt ?? null))}</Fact>
      <Fact label={channel?.status === 'FAILED' ? '자동 재시도 종료' : '자동 재시도 종료 예정'}>
        {orNone(localClock(channel?.retryExpiresAt ?? null))}
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
  const ticketKind = kind === 'jira-ticket-failed';

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

  return (
    <ModalShell open onClose={onClose} labelledBy={TITLE_ID} variant="wide" className={styles.shell}>
      <div className={styles.head}>
        <div>
          <h3 id={TITLE_ID} className={styles.title}>
            {ticketKind ? '티켓 다시 생성' : 'Watcher 등록 실패'}
          </h3>
          <p className={styles.lead}>
            {ticketKind
              ? '자동 생성에 실패한 Jira 티켓을 한 번 더 생성 요청합니다. 14일 기한은 그대로예요.'
              : '등록에 실패한 사용자를 여기서 다시 등록합니다. 결과는 Jira 에서 확인됩니다.'}
          </p>
        </div>
        <button type="button" className={jobStyles.vClose} onClick={onClose} aria-label="닫기" title="닫기 (Esc)">
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className={styles.card} data-testid="target-card">
        <div className={styles.cardMain}>
          <div className={styles.cardLine1}>
            <ProvTag provider={row.cloudProvider ?? ''} isSdu={row.isSduType} isChina={row.isChinaRegion} size="lg" />
            <span className={styles.cardDesc} title={row.description ?? undefined}>
              {row.description ?? '—'}
            </span>
          </div>
          <p className={styles.cardLine2}>
            Target <b className={styles.cardStrong}>{id ?? '—'}</b> · {row.serviceCode ?? '—'}{' '}
            <b className={styles.cardStrong}>{row.serviceName ?? '—'}</b>
          </p>
        </div>
        <ChannelTag channel={channel} />
      </div>

      <div className={styles.facts} data-testid="facts">
        <Facts kind={kind} channel={channel} />
      </div>

      <div className={styles.body}>
        {ticketKind ? (
          <RetryPanel id={id} channel={channel} busy={busy} reload={() => reload()} />
        ) : (
          <WatcherPanel row={row} channel={channel} busy={busy} reload={reload} />
        )}
      </div>

      <div className={styles.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={busy}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
