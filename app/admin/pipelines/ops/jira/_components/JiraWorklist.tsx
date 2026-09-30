'use client';

/**
 * Jira Ticket worklist — ONE table for the bucket the tiles selected.
 *
 * 운영 알림 표(`AlertWorklist`)와 같은 뼈대(메타 한 줄 · table-fixed · 페이저)지만 열이
 * 다르다: Lifecycle·지연 대신 **협업 채널**과 (버킷에 따라) **다음 시도** 또는 **티켓**.
 * 행은 운영 화면으로 가지 않는다 — 이 탭 안에서 모달을 연다. 관리자가 할 일이 티켓 연결
 * 하나뿐이고, 그 입력은 한 칸이라 화면을 옮길 이유가 없다.
 */
import { useState, useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { JiraAlertKind, JiraListRow } from '@/lib/types/task-queue';
import { localClock, type CollaborationChannel } from '@/lib/types/collaboration-channel';
import { DashRow, RowAction } from '@/app/admin/pipelines/_dashboard/cells';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { PAGE_SIZE, worklist } from '@/app/admin/pipelines/ops/alerts/_components/worklistStyles';
import type { JiraBucketIcon } from '@/app/admin/pipelines/ops/jira/_components/jiraBuckets';
import { JiraBucketGlyph } from '@/app/admin/pipelines/ops/jira/_components/JiraHeader';
import { ChannelTag, WatcherFailTag } from '@/app/admin/pipelines/ops/jira/_components/ChannelTag';
import { JiraChannelModal } from '@/app/admin/pipelines/ops/jira/_components/JiraChannelModal';

/** A list row plus the channel the server read for it (null = that GET failed). */
export interface JiraWorklistRow extends JiraListRow {
  channel: CollaborationChannel | null;
}

interface WorklistMetaProps {
  kind: JiraAlertKind;
  label: string;
  owner: string;
  /** null = 요약을 못 읽었다 — 0 건과 다르다. */
  count: number | null;
  icon: JiraBucketIcon;
}

/** 12px sub-line under a tag (issue key, usernames). */
const subLine = 'mt-0.5 block truncate text-[12px] text-[var(--pl-text-weak)]';

/** The first watcher page's names; the people beyond it are counted, not listed. */
const watcherNames = (channel: CollaborationChannel): string => {
  const names = channel.failedWatchers.map((w) => w.username).join(', ');
  const rest = channel.failedWatchersTotal - channel.failedWatchers.length;
  return rest > 0 ? `${names} 외 ${rest}명` : names;
};

function WorklistMeta({ label, owner, count, icon }: WorklistMetaProps): ReactElement {
  return (
    <p className={worklist.meta}>
      <span className={worklist.metaIcon}>
        <JiraBucketGlyph icon={icon} size={14} />
      </span>
      <span className={worklist.metaLabel}>{label}</span>
      {count !== null ? (
        <span>
          <span className={worklist.metaCount}>{count}</span>건
        </span>
      ) : null}
      <span className={worklist.metaSep} aria-hidden="true">
        ·
      </span>
      <span>{owner}</span>
    </p>
  );
}

/** 열 스펙은 표와 스켈레톤이 한 벌을 쓴다 — 도착하는 순간 열이 뛰지 않도록. */
function WorklistHead({ kind }: { kind: JiraAlertKind }): ReactElement {
  return (
    <thead>
      <tr>
        <th className={cn(worklist.th, 'w-[9%] min-w-[96px]')}>Cloud</th>
        <th className={cn(worklist.th, 'w-[9%] min-w-[96px]')}>Target</th>
        <th className={cn(worklist.th, 'w-[10%] min-w-[104px]')}>서비스 코드</th>
        <th className={cn(worklist.th, 'w-[18%]')}>서비스 이름</th>
        <th className={cn(worklist.th, 'w-[18%]')}>설명</th>
        <th className={cn(worklist.th, 'w-[18%] min-w-[160px]')}>협업 채널</th>
        <th className={cn(worklist.th, 'w-[12%] min-w-[104px]')}>
          {kind === 'jira-ticket-failed' ? '다음 시도' : '티켓'}
        </th>
        <th className={cn(worklist.th, 'w-[6%] min-w-[64px]')} />
      </tr>
    </thead>
  );
}

export interface JiraWorklistProps extends WorklistMetaProps {
  rows: JiraWorklistRow[];
  /** 0-based, 계약과 같은 축. */
  page: number;
  totalPages: number;
  failed: boolean;
}

export function JiraWorklist({
  kind,
  label,
  owner,
  count,
  icon,
  rows,
  page,
  totalPages,
  failed,
}: JiraWorklistProps): ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState<JiraWorklistRow | null>(null);

  const goToPage = (next: number) => {
    startTransition(() => {
      const query = next > 0 ? `?kind=${kind}&page=${next + 1}` : `?kind=${kind}`;
      router.push(`${passRoutes.pipelines.ops.jira}${query}`);
    });
  };

  const d = pipelineStyles.dashboard;

  return (
    <section className={worklist.block} aria-label={`${label} 대상 목록`}>
      <WorklistMeta kind={kind} label={label} owner={owner} count={count} icon={icon} />

      <table className={worklist.table}>
        <WorklistHead kind={kind} />
        <tbody className={worklist.body}>
          {failed ? (
            <tr>
              <td colSpan={8} className={worklist.state}>
                목록을 불러오지 못했습니다.
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={8} className={worklist.state}>
                해당 단계의 대상이 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row, index) => {
              const id = row.targetSourceId;
              const clock = localClock(row.channel?.nextAttemptAt ?? null);
              const cells = (
                <>
                  <td className={cn(d.cell, 'whitespace-nowrap')}>
                    <ProvTag provider={row.cloudProvider ?? ''} isSdu={row.isSduType} isChina={row.isChinaRegion} />
                  </td>
                  <td className={d.cell}>
                    <span className={worklist.idValue}>{id ?? '—'}</span>
                  </td>
                  <td className={cn(d.cell, 'whitespace-nowrap')}>
                    <span className={worklist.codeText}>{row.serviceCode ?? '—'}</span>
                  </td>
                  <td className={d.cell}>
                    <span className={worklist.nameText} title={row.serviceName ?? undefined}>
                      {row.serviceName ?? '—'}
                    </span>
                  </td>
                  <td className={d.cell}>
                    <span className={worklist.descText} title={row.description ?? undefined}>
                      {row.description ?? '—'}
                    </span>
                  </td>
                  <td className={d.cell}>
                    {kind === 'jira-ticket-failed' ? (
                      <>
                        <ChannelTag channel={row.channel} />
                        {row.channel?.issueKey ? (
                          <span className={subLine}>{row.channel.issueKey}</span>
                        ) : null}
                        {row.channel?.manualRetryPending ? (
                          <span className={subLine}>
                            재시도 접수 {localClock(row.channel.manualRetryRequestedAt) ?? '—'}
                          </span>
                        ) : null}
                      </>
                    ) : row.channel ? (
                      <>
                        <WatcherFailTag count={row.channel.failedWatchersTotal} />
                        {row.channel.failedWatchers.length > 0 ? (
                          <span className={subLine} title={watcherNames(row.channel)}>
                            {watcherNames(row.channel)}
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <ChannelTag channel={null} />
                    )}
                  </td>
                  <td className={cn(d.cell, 'whitespace-nowrap')}>
                    {kind === 'jira-ticket-failed' ? (
                      clock ? (
                        <span className="text-[14px] tabular-nums text-[var(--pl-text-strong)]">{clock}</span>
                      ) : (
                        <span className={d.elapsed}>—</span>
                      )
                    ) : row.channel?.issueKey ? (
                      <span className={worklist.codeText}>{row.channel.issueKey}</span>
                    ) : (
                      <span className={d.elapsed}>—</span>
                    )}
                  </td>
                  <td className={d.actionCell}>{id != null ? <RowAction /> : null}</td>
                </>
              );

              // id 없는 행은 열지 않는다 — 운영 알림 표와 같은 판단.
              return id == null ? (
                <tr key={`no-id:${row.serviceCode ?? ''}:${index}`}>{cells}</tr>
              ) : (
                <DashRow
                  key={id}
                  label={`${row.serviceName ?? '이름 없음'} (Target ${id}) 협업 채널 열기`}
                  onActivate={() => setOpen(row)}
                >
                  {cells}
                </DashRow>
              );
            })
          )}
        </tbody>
      </table>

      {failed ? null : (
        <div className={worklist.footer}>
          <OpsPagination page={page} totalPages={totalPages} onChange={goToPage} always />
        </div>
      )}

      {open ? <JiraChannelModal kind={kind} row={open} onClose={() => setOpen(null)} /> : null}
    </section>
  );
}

/** 로딩 자리 — 상위 `Suspense` 의 fallback (운영 알림과 같은 규칙). */
export function JiraWorklistSkeleton({ kind, label, owner, icon, count }: WorklistMetaProps): ReactElement {
  const d = pipelineStyles.dashboard;
  return (
    <section className={worklist.block} aria-busy="true" aria-label={`${label} 대상 목록 불러오는 중`}>
      <WorklistMeta kind={kind} label={label} owner={owner} count={count} icon={icon} />
      <table className={worklist.table}>
        <WorklistHead kind={kind} />
        <tbody className={worklist.body}>
          {Array.from({ length: Math.min(Math.max(count ?? PAGE_SIZE, 1), PAGE_SIZE) }, (_, row) => (
            <tr key={row} aria-hidden="true">
              {Array.from({ length: 7 }, (_, col) => (
                <td key={col} className={d.cell}>
                  <span className={worklist.skeletonBar} />
                </td>
              ))}
              <td className={d.actionCell} />
            </tr>
          ))}
        </tbody>
      </table>
      <div className={worklist.footer} />
    </section>
  );
}
