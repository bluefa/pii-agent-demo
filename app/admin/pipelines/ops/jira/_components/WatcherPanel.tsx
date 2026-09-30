'use client';

/**
 * Watcher 버킷의 동작 블록 — 머리 줄(사람 수 · 페이지 · [전체 등록]) 과 5행 고정 표, 페이저.
 * 실계약 `POST /services/{code}/jira-tickets/{provider}/watchers` 로 한 명씩, 또는 [전체 등록]
 * 으로 이 티켓의 실패한 사용자 **전부**를 차례로 다시 등록한다(오너: 한 페이지만 등록하는
 * 버튼은 없느니만 못하다). 표는 채널 GET 의 한 페이지(`WATCHER_PAGE_SIZE`)고, 사람별 결과는
 * 창이 살아 있는 동안 남아 페이지를 넘겨도 제 행에 표시된다.
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { displayProvider } from '@/lib/pipeline/format';
import { localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { userErrorText } from '@/app/admin/pipelines/ops/services/_components/errorText';
import type { JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import {
  JIRA_CLOUD_PROVIDERS,
  addJiraTicketWatcher,
  getCollaborationChannel,
  type JiraCloudProvider,
} from '@/app/lib/api/ops';

/** 전체 등록이 사용자 목록을 모을 때의 페이지 크기 — 서버 상한(`watcher_size` 1..100). */
const GATHER_PAGE_SIZE = 100;
/** 한 번에 등록하는 사람 수 상한. ponytail: raise when a ticket actually carries more. */
export const BULK_REGISTER_CAP = 500;

const styles = {
  headingRow: 'flex items-center justify-between gap-4',
  heading: 'text-[14px] font-semibold leading-[1.4] text-[var(--pl-text-medium)] tabular-nums',
  headingStrong: 'text-[var(--pl-text-strong)]',
  /** 전체 등록 진행 — 머리 줄 아래 12px 한 줄. */
  progress: 'mt-0.5 text-[12px] leading-[1.4] text-[var(--pl-text-weak)] tabular-nums',
  note: 'mt-3 text-[12px] text-[var(--pl-text-weak)]',
  /**
   * 표 상자 — 높이가 **5행으로 고정**이다(머리 32 + 36×5, `WATCHER_PAGE_SIZE`). 마지막 페이지가
   * 2행이어도 창이 줄지 않고, 100명이어도 창은 이 높이 그대로다: 넘치는 사람은 페이저가 받는다.
   */
  tableBox: 'mt-3 h-[212px] overflow-hidden rounded-[10px] border border-[var(--pl-border)]',
  table: 'w-full table-fixed text-[14px]',
  th: 'h-8 bg-[var(--pl-bg-inner)] px-4 text-left text-[12px] font-semibold text-[var(--pl-text-medium)] border-b border-[var(--pl-border)]',
  td: 'h-9 px-4 text-[var(--pl-text-strong)] border-b border-[var(--pl-gray-100)]',
  user: 'block truncate text-[14px] font-semibold text-[var(--pl-text-strong)]',
  rowError: 'block truncate text-[12px] font-normal text-[var(--pl-err-text)]',
  muted: 'text-[var(--pl-text-medium)] tabular-nums',
  doneTag: cn(
    'inline-flex items-center whitespace-nowrap rounded border px-1.5 py-px text-[12px] font-semibold leading-4',
    'border-[var(--pl-ok-text)] bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]',
  ),
  pager: 'flex justify-center',
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
  const toast = usePlToast();
  /** username → 등록 진행. 창이 살아 있는 동안 남는다 — 페이지를 넘겨도 제 행에 표시된다. */
  const [registrations, setRegistrations] = useState<Record<string, Registration>>({});
  /** 「전체 등록」 진행 — n/N(N = 실패한 사람 전체) 과 그중 실패 f. */
  const [bulk, setBulk] = useState<{ done: number; failed: number; total: number } | null>(null);
  const id = row.targetSourceId;

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
  const register = async (username: string): Promise<boolean> => {
    if (row.serviceCode == null || !isJiraCloudProvider(watcherProvider)) return false;
    setRegistrations((prev) => ({ ...prev, [username]: { state: 'busy' } }));
    try {
      await addJiraTicketWatcher(row.serviceCode, watcherProvider, username);
      setRegistrations((prev) => ({ ...prev, [username]: { state: 'done' } }));
      return true;
    } catch (err) {
      setRegistrations((prev) => ({
        ...prev,
        [username]: { state: 'error', message: userErrorText(err, '등록에 실패했어요. 잠시 후 다시 시도해 주세요.') },
      }));
      return false;
    }
  };

  /**
   * 이 티켓의 실패한 사용자 전부 — 서버 상한(100)으로 끝까지 넘겨 모으고, 이름으로 중복을
   * 걷고, 이 창에서 이미 등록된 사람은 건너뛴 뒤 한 번에 하나씩 POST 한다. 실패해도 다음으로
   * 간다. 끝나면 결과를 toast 로 세고 보던 페이지를 다시 읽는다.
   */
  const registerAll = async (): Promise<void> => {
    if (id == null || !channel) return;
    const total = channel.failedWatchersTotal;
    setBulk({ done: 0, failed: 0, total });
    const names: string[] = [];
    const seen = new Set<string>();
    try {
      for (let page = 0; page * GATHER_PAGE_SIZE < total; page += 1) {
        const chunk = await getCollaborationChannel(id, { watcherPage: page, watcherSize: GATHER_PAGE_SIZE });
        if (!chunk || chunk.failedWatchers.length === 0) break;
        for (const w of chunk.failedWatchers) {
          if (seen.has(w.username)) continue;
          seen.add(w.username);
          names.push(w.username);
        }
      }
    } catch (err) {
      setBulk(null);
      toast.show(userErrorText(err, '사용자 목록을 읽지 못했어요. 잠시 후 다시 시도해 주세요.'));
      return;
    }
    let done = 0;
    let failed = 0;
    for (const name of names) {
      if (registrations[name]?.state === 'done') continue;
      if (await register(name)) done += 1;
      else failed += 1;
      setBulk({ done: done + failed, failed, total });
    }
    setBulk(null);
    toast.show(`watcher ${done}명 등록, ${failed}명 실패`);
    await reload(channel.watcherPage);
  };

  const anyBusy = busy || bulk !== null || Object.values(registrations).some((r) => r.state === 'busy');
  const total = channel?.failedWatchersTotal ?? 0;
  const overCap = total > BULK_REGISTER_CAP;
  const totalPages = channel ? Math.max(1, Math.ceil(total / channel.watcherSize)) : 1;

  return (
    <section aria-label="등록 실패한 사용자">
      <div className={styles.headingRow}>
        <div>
          <p className={styles.heading}>
            사용자 <b className={styles.headingStrong}>{channel?.failedWatchersTotal ?? '—'}</b>명 ·{' '}
            {channel ? channel.watcherPage + 1 : '—'} / {totalPages} 페이지
          </p>
          {bulk ? (
            <p className={styles.progress} role="status">
              등록 중 {bulk.done}/{bulk.total} · 실패 {bulk.failed}
            </p>
          ) : null}
        </div>
        {total > 0 ? (
          <PlButton
            variant="secondary"
            size="sm"
            onClick={() => void registerAll()}
            // blocked, not disabled, when the reason has to stay reachable in the title
            // (a cloud outside the watcher API's enum, or more people than one run takes).
            blocked={!canRegister || overCap}
            disabled={anyBusy}
            title={
              !canRegister ? '등록할 수 없는 클라우드' : overCap ? `${BULK_REGISTER_CAP}명까지 한 번에 등록할 수 있어요` : undefined
            }
          >
            {bulk ? `등록 중 ${bulk.done}/${bulk.total}` : '전체 등록'}
          </PlButton>
        ) : null}
      </div>

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
                <th className={cn(styles.th, 'w-[18%]')}>상태</th>
                <th className={cn(styles.th, 'w-[12%]')}>시도</th>
                <th className={cn(styles.th, 'w-[18%]')}>다음 시도</th>
                <th className={cn(styles.th, 'w-[12%]')} />
              </tr>
            </thead>
            <tbody>
              {watchers.map((watcher) => {
                const reg = registrations[watcher.username];
                return (
                  <tr key={watcher.username}>
                    <td className={cn(styles.td, 'min-w-0')}>
                      <span className={styles.user} title={watcher.username}>
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
                    <td className={cn(styles.td, styles.muted)}>{watcher.attemptCount ?? '—'}</td>
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
                          {reg?.state === 'busy' ? (
                            <Icon name="loader" size={12} className="animate-spin motion-reduce:animate-none" />
                          ) : null}
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
        <div className={styles.pager}>
          <OpsPagination page={channel.watcherPage} totalPages={totalPages} onChange={(next) => void reload(next)} />
        </div>
      ) : null}
    </section>
  );
}
