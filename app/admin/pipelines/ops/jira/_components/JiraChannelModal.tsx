'use client';

/**
 * 협업 채널 모달 — 표의 한 행이 여는 창.
 *
 * 티켓 버킷: 생성을 한 번 더 요청한다(`RetryPanel`, `POST …/collaboration-channel/retry`) —
 * 이슈 키를 손으로 연결하는 길은 이 콘솔에 없다(오너 2026-09-30 "attach 는 없애줘"; 서비스
 * 운영 화면의 연결이 그 길이다). Watcher 버킷: 등록에 실패한 사용자를 실계약
 * `POST /services/{code}/jira-tickets/{provider}/watchers` 로 한 명씩(또는 이 페이지 전부
 * 차례로) 다시 등록한다. 사용자 표는 채널 GET 이 페이지 단위로 준다(`watcher_page`).
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { safeBrowseUrl } from '@/lib/jira-ticket';
import { displayProvider } from '@/lib/pipeline/format';
import type { JiraAlertKind } from '@/lib/types/task-queue';
import { WATCHER_PAGE_SIZE, localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import { worklist } from '@/app/admin/pipelines/ops/alerts/_components/worklistStyles';
import { ChannelTag } from '@/app/admin/pipelines/ops/jira/_components/ChannelTag';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { RetryPanel } from '@/app/admin/pipelines/ops/jira/_components/RetryPanel';
import {
  JIRA_CLOUD_PROVIDERS,
  addJiraTicketWatcher,
  getCollaborationChannel,
  type JiraCloudProvider,
} from '@/app/lib/api/ops';

const TITLE_ID = 'ops-jira-channel-title';

const styles = {
  title: 'mb-3 text-[20px] font-bold leading-[1.25] text-[var(--pl-text-strong)]',
  /** 머리띠 — 어느 대상인지 한 줄. */
  strip: 'flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] text-[var(--pl-text-medium)]',
  stripId: 'font-semibold tabular-nums text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]',
  /** 상태 줄 — 태그 + 12px 보조 줄(한 줄 한 사실). */
  status: 'mt-4 flex flex-col items-start gap-1',
  subLine: 'text-[12px] tabular-nums text-[var(--pl-text-weak)]',
  link: 'inline-flex items-center gap-1 text-[12px] font-medium text-[var(--pl-info-text)] hover:underline',
  body: 'mt-4',
  /** 표 머리 동작 줄 — 페이지 단위 등록 버튼이 표 위에 선다. */
  tableHead: 'mt-3 flex items-center justify-end',
  /**
   * Watcher 표 영역 — 높이가 **5행으로 고정**이다(머리 32 + 36×5, `WATCHER_PAGE_SIZE`). 마지막 페이지가 2행이어도
   * 창이 줄지 않고, 100명이어도 창은 이 높이 그대로다: 넘치는 사람은 페이저가 받는다.
   */
  tableBox: 'mt-2 h-[212px] overflow-hidden',
  table: 'w-full table-fixed text-[14px]',
  th: 'h-8 px-2 text-left text-[12px] font-semibold text-[var(--pl-text-medium)] border-b border-[var(--pl-border)]',
  td: 'h-9 px-2 text-[var(--pl-text-strong)] border-b border-[var(--pl-gray-100)]',
  userCell: 'min-w-0 truncate',
  rowError: 'block truncate text-[12px] font-normal text-[var(--pl-err-text)]',
  doneTag: cn(
    'inline-flex items-center whitespace-nowrap rounded border px-1.5 py-px text-[12px] font-semibold leading-4',
    'border-[var(--pl-ok-text)] bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  ),
} as const;

/** Watcher 상태는 둘뿐이다 — PENDING 은 인증·권한 대기까지 포함해 "아직 재시도 중". */
const WATCHER_STATUS_COPY = { FAILED: '등록 실패', PENDING: '재시도 중' } as const;

/** 한 사람의 등록 진행 — 없으면 아직 안 누른 것. */
type Registration = { state: 'busy' } | { state: 'done' } | { state: 'error'; message: string };

const isJiraCloudProvider = (value: string): value is JiraCloudProvider =>
  (JIRA_CLOUD_PROVIDERS as readonly string[]).includes(value);

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

/**
 * 상태 줄의 보조 줄들 — 한 줄에 사실 하나, 값이 있을 때만. RETRYING: 실패 횟수 · 다음
 * 시도 · 자동 재시도 종료 예정(14일 창). FAILED: 종료 시각(만료로 닫혔을 때). CREATED: 키.
 */
function StatusSubLines({ channel }: { channel: CollaborationChannel | null }): ReactElement | null {
  if (!channel) return null;
  if (channel.status === 'RETRYING') {
    const next = localClock(channel.nextAttemptAt);
    const expires = localClock(channel.retryExpiresAt);
    return (
      <>
        {channel.attemptCount != null && channel.attemptCount > 0 ? (
          <span className={styles.subLine}>실패 {channel.attemptCount}회</span>
        ) : null}
        {next ? <span className={styles.subLine}>다음 시도 {next}</span> : null}
        {expires ? <span className={styles.subLine}>자동 재시도 종료 예정 {expires}</span> : null}
      </>
    );
  }
  if (channel.status === 'FAILED') {
    const expired = localClock(channel.retryExpiresAt);
    return expired ? <span className={styles.subLine}>자동 재시도 종료 {expired}</span> : null;
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
  const [channel, setChannel] = useState<CollaborationChannel | null>(row.channel);
  const [busy, setBusy] = useState(false);
  /** username → 등록 진행. 페이지를 넘기면 비운다 — 다른 사람들이다. */
  const [registrations, setRegistrations] = useState<Record<string, Registration>>({});
  /** 「이 페이지 모두 등록」 진행 — 라벨의 n/N. */
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const id = row.targetSourceId;
  const shownProvider = displayProvider(row.cloudProvider, row.isSduType);
  /** watcher API 의 경로 값 — 실계약 enum 밖(빈 값 등)이면 등록할 수 없다. */
  const watcherProvider = shownProvider.toUpperCase();
  const canRegister = row.serviceCode != null && isJiraCloudProvider(watcherProvider);

  /** 채널을 다시 읽는다 — 못 읽으면 null(조회 실패), 지어내지 않는다. */
  const reload = async (watcherPage?: number) => {
    if (id == null) return;
    setBusy(true);
    try {
      setChannel(
        await getCollaborationChannel(id, {
          watcherSize: WATCHER_PAGE_SIZE,
          ...(watcherPage != null ? { watcherPage } : {}),
        }),
      );
      // 다른 페이지는 다른 사람들이다 — 이 페이지의 등록 표시는 함께 떠난다.
      if (watcherPage != null) setRegistrations({});
    } catch {
      setChannel(null);
    } finally {
      setBusy(false);
    }
  };

  /**
   * 한 사람 등록 — 실계약 POST …/watchers { userId }. userId 는 watcher 의 username
   * 이라고 가정한다(BE 확인 대기, docs/api/ops-assumed-contracts.md §12).
   *
   * 성공해도 채널을 다시 읽지 않는다 — 실패 목록은 jira-manager 의 상태라 바로 반영되지
   * 않을 수 있고, 그때 다시 읽으면 방금 등록한 사람이 여전히 「등록 실패」 로 돌아온다.
   * 로컬 「등록됨」 표시를 지키고, 페이지를 넘길 때만 다시 읽는다.
   * ponytail: no re-GET after registration; drop this once the BE clears the watcher
   * from the failed list synchronously (then reload() here is the upgrade).
   */
  const register = async (username: string): Promise<void> => {
    if (row.serviceCode == null || !isJiraCloudProvider(watcherProvider)) return;
    setRegistrations((prev) => ({ ...prev, [username]: { state: 'busy' } }));
    try {
      await addJiraTicketWatcher(row.serviceCode, watcherProvider, username);
      setRegistrations((prev) => ({ ...prev, [username]: { state: 'done' } }));
    } catch (err) {
      setRegistrations((prev) => ({
        ...prev,
        [username]: {
          state: 'error',
          message: userErrorText(err, '등록에 실패했어요. 잠시 후 다시 시도해 주세요.'),
        },
      }));
    }
  };

  /** 이 페이지의 아직 안 된 사람들을 차례로 — 한 번에 하나, 실패해도 다음으로 간다. */
  const registerPage = async (): Promise<void> => {
    const pending = (channel?.failedWatchers ?? [])
      .map((w) => w.username)
      .filter((name) => registrations[name]?.state !== 'done');
    if (pending.length === 0) return;
    setBulk({ done: 0, total: pending.length });
    for (const [index, name] of pending.entries()) {
      await register(name);
      setBulk({ done: index + 1, total: pending.length });
    }
    setBulk(null);
  };

  const anyBusy = busy || bulk !== null || Object.values(registrations).some((r) => r.state === 'busy');
  const pageDone = (channel?.failedWatchers ?? []).every((w) => registrations[w.username]?.state === 'done');

  const watcherPages = channel ? Math.max(1, Math.ceil(channel.failedWatchersTotal / channel.watcherSize)) : 1;

  return (
    // Watcher 버킷은 `task`(600px · 높이 상한 · 본문 스크롤) — 사람 수가 창 높이를 정하지 않는다.
    <ModalShell
      open
      onClose={onClose}
      labelledBy={TITLE_ID}
      variant={kind === 'jira-watcher-failed' ? 'task' : 'default'}
    >
      <h3 id={TITLE_ID} className={styles.title}>
        {kind === 'jira-ticket-failed' ? '티켓 다시 생성' : 'Watcher 등록 실패'}
      </h3>

      <div className={styles.strip}>
        <ProvTag provider={row.cloudProvider ?? ''} isSdu={row.isSduType} isChina={row.isChinaRegion} />
        <span className={styles.stripId}>Target {id ?? '—'}</span>
        <span>
          {row.serviceCode ?? '—'} · {row.serviceName ?? '—'}
          {row.description ? ` · ${row.description}` : ''}
        </span>
      </div>

      <div className={styles.status}>
        <ChannelTag channel={channel} />
        <StatusSubLines channel={channel} />
      </div>

      {kind === 'jira-ticket-failed' ? (
        <div className={styles.body}>
          <RetryPanel id={id} channel={channel} busy={busy} reload={() => reload()} />
        </div>
      ) : (
        <div className={cn(styles.body, pipelineStyles.modal.body)}>
          <p className={pipelineStyles.modal.desc}>
            등록에 실패한 사용자를 여기서 다시 등록할 수 있습니다. 등록 결과는 Jira 에서 확인됩니다.
          </p>
          {!channel ? (
            <p className={styles.subLine}>추가할 사용자를 응답에서 읽지 못했어요.</p>
          ) : channel.failedWatchers.length === 0 ? (
            <p className={styles.subLine}>등록에 실패한 사용자가 없습니다.</p>
          ) : (
            <>
              <div className={styles.tableHead}>
                <PlButton
                  variant="secondary"
                  size="sm"
                  onClick={() => void registerPage()}
                  // blocked, not disabled, when the cloud is outside the watcher API's enum —
                  // the title has to stay reachable to say why.
                  blocked={!canRegister}
                  disabled={anyBusy || pageDone}
                  title={canRegister ? undefined : '등록할 수 없는 클라우드'}
                >
                  {bulk ? `등록 중 ${bulk.done}/${bulk.total}` : '이 페이지 모두 등록'}
                </PlButton>
              </div>
              <div className={styles.tableBox} data-testid="watcher-table-box">
                <table className={styles.table} aria-busy={anyBusy || undefined}>
                  <thead>
                    <tr>
                      <th className={styles.th}>사용자</th>
                      <th className={cn(styles.th, 'w-[88px]')}>상태</th>
                      <th className={cn(styles.th, 'w-[56px]')}>시도</th>
                      <th className={cn(styles.th, 'w-[104px]')}>다음 시도</th>
                      <th className={cn(styles.th, 'w-[72px]')} />
                    </tr>
                  </thead>
                  <tbody>
                    {channel.failedWatchers.map((watcher) => {
                      const reg = registrations[watcher.username];
                      return (
                        <tr key={watcher.username}>
                          <td className={cn(styles.td, styles.userCell)}>
                            <span className={cn(worklist.codeText, 'block truncate')} title={watcher.username}>
                              {watcher.username}
                            </span>
                            {reg?.state === 'error' ? (
                              <span role="alert" className={styles.rowError} title={reg.message}>
                                {reg.message}
                              </span>
                            ) : null}
                          </td>
                          <td className={styles.td}>
                            {reg?.state === 'done' ? (
                              <span className={styles.doneTag}>등록됨</span>
                            ) : (
                              WATCHER_STATUS_COPY[watcher.status]
                            )}
                          </td>
                          <td className={cn(styles.td, 'tabular-nums')}>{watcher.attemptCount ?? '—'}</td>
                          <td className={cn(styles.td, 'tabular-nums whitespace-nowrap')}>
                            {localClock(watcher.nextAttemptAt) ?? '—'}
                          </td>
                          <td className={cn(styles.td, 'text-right')}>
                            {reg?.state === 'done' ? null : (
                              <PlButton
                                variant="secondary"
                                size="sm"
                                onClick={() => void register(watcher.username)}
                                blocked={!canRegister}
                                disabled={anyBusy}
                                title={canRegister ? undefined : '등록할 수 없는 클라우드'}
                                aria-label={`${watcher.username} 등록`}
                              >
                                등록
                              </PlButton>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {channel && channel.failedWatchersTotal > channel.watcherSize ? (
            <OpsPagination
              page={channel.watcherPage}
              totalPages={watcherPages}
              onChange={(next) => void reload(next)}
            />
          ) : null}
        </div>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose} disabled={busy}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
