'use client';

/**
 * 「등록 실패한 사용자」 — watcher 버킷 모달의 섹션. 실계약
 * `POST /services/{code}/jira-tickets/{provider}/watchers` 로 한 명씩(또는 이 페이지 전부
 * 차례로) 다시 등록한다. 표는 채널 GET 의 한 페이지(`WATCHER_PAGE_SIZE`)다.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { displayProvider } from '@/lib/pipeline/format';
import { localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import { worklist } from '@/app/admin/pipelines/ops/alerts/_components/worklistStyles';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { JIRA_CLOUD_PROVIDERS, addJiraTicketWatcher, type JiraCloudProvider } from '@/app/lib/api/ops';

const styles = {
  headingRow: 'flex items-center justify-between gap-4',
  heading: cn(pipelineStyles.text.subsectionTitle, 'block'),
  desc: cn(pipelineStyles.modal.desc, 'mt-1'),
  note: 'text-[12px] text-[var(--pl-text-weak)]',
  /**
   * 표 영역 — 높이가 **5행으로 고정**이다(머리 32 + 36×5, `WATCHER_PAGE_SIZE`). 마지막
   * 페이지가 2행이어도 창이 줄지 않고, 100명이어도 창은 이 높이 그대로다: 넘치는 사람은
   * 페이저가 받는다.
   */
  tableBox: 'mt-2 h-[212px] overflow-hidden',
  table: 'w-full table-fixed text-[14px]',
  th: 'h-8 px-3 text-left text-[12px] font-semibold text-[var(--pl-text-medium)] border-b border-[var(--pl-border)]',
  td: 'h-9 px-3 text-[var(--pl-text-strong)] border-b border-[var(--pl-gray-100)]',
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

export function WatcherPanel({
  row,
  channel,
  busy,
  reload,
}: {
  row: JiraWorklistRow;
  channel: CollaborationChannel | null;
  /** 상위가 채널을 읽는 중. */
  busy: boolean;
  /** 페이지를 넘긴다 — 다른 사람들이라 이 페이지의 등록 표시는 함께 떠난다. */
  reload: (watcherPage: number) => Promise<void>;
}): ReactElement {
  /** username → 등록 진행. */
  const [registrations, setRegistrations] = useState<Record<string, Registration>>({});
  /** 「이 페이지 모두 등록」 진행 — 라벨의 n/N. */
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  /** watcher API 의 경로 값 — 실계약 enum 밖(빈 값 등)이면 등록할 수 없다. */
  const watcherProvider = displayProvider(row.cloudProvider, row.isSduType).toUpperCase();
  const canRegister = row.serviceCode != null && isJiraCloudProvider(watcherProvider);
  const watchers = channel?.failedWatchers ?? [];

  /**
   * 한 사람 등록 — userId 는 watcher 의 username 이라고 가정한다(BE 확인 대기, §12).
   * 성공해도 채널을 다시 읽지 않는다 — 실패 목록은 jira-manager 의 상태라 바로 반영되지
   * 않을 수 있고, 그때 다시 읽으면 방금 등록한 사람이 여전히 「등록 실패」 로 돌아온다.
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
        [username]: { state: 'error', message: userErrorText(err, '등록에 실패했어요. 잠시 후 다시 시도해 주세요.') },
      }));
    }
  };

  /** 이 페이지의 아직 안 된 사람들을 차례로 — 한 번에 하나, 실패해도 다음으로 간다. */
  const registerPage = async (): Promise<void> => {
    const pending = watchers.map((w) => w.username).filter((name) => registrations[name]?.state !== 'done');
    if (pending.length === 0) return;
    setBulk({ done: 0, total: pending.length });
    for (const [index, name] of pending.entries()) {
      await register(name);
      setBulk({ done: index + 1, total: pending.length });
    }
    setBulk(null);
  };

  const turnPage = async (page: number): Promise<void> => {
    await reload(page);
    setRegistrations({});
  };

  const anyBusy = busy || bulk !== null || Object.values(registrations).some((r) => r.state === 'busy');
  const pageDone = watchers.every((w) => registrations[w.username]?.state === 'done');
  const watcherPages = channel ? Math.max(1, Math.ceil(channel.failedWatchersTotal / channel.watcherSize)) : 1;

  return (
    <section aria-labelledby="ops-jira-watchers-heading">
      <div className={styles.headingRow}>
        <h4 id="ops-jira-watchers-heading" className={styles.heading}>
          등록 실패한 사용자
        </h4>
        {watchers.length > 0 ? (
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
        ) : null}
      </div>
      <p className={styles.desc}>
        등록에 실패한 사용자를 여기서 다시 등록할 수 있습니다. 등록 결과는 Jira 에서 확인됩니다.
      </p>

      {!channel ? (
        <p className={styles.note}>추가할 사용자를 응답에서 읽지 못했어요.</p>
      ) : watchers.length === 0 ? (
        <p className={styles.note}>등록에 실패한 사용자가 없습니다.</p>
      ) : (
        <div className={styles.tableBox} data-testid="watcher-table-box">
          <table className={styles.table} aria-busy={anyBusy || undefined}>
            <thead>
              <tr>
                <th className={cn(styles.th, 'w-[40%]')}>사용자</th>
                <th className={styles.th}>상태</th>
                <th className={cn(styles.th, 'w-[64px]')}>시도</th>
                <th className={cn(styles.th, 'w-[112px]')}>다음 시도</th>
                <th className={cn(styles.th, 'w-[88px]')} />
              </tr>
            </thead>
            <tbody>
              {watchers.map((watcher) => {
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
                      {reg?.state === 'done' ? <span className={styles.doneTag}>등록됨</span> : WATCHER_STATUS_COPY[watcher.status]}
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
      )}

      {channel && channel.failedWatchersTotal > channel.watcherSize ? (
        <OpsPagination page={channel.watcherPage} totalPages={watcherPages} onChange={(next) => void turnPage(next)} />
      ) : null}
    </section>
  );
}
