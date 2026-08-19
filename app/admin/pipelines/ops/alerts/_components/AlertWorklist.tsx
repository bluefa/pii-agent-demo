'use client';

/**
 * 운영 알림 worklist — ONE table for the bucket the summary tiles selected.
 *
 * Replaces the 2×2 AlertStageCard grid (decision record:
 * docs/ux/benchmark/ops-alerts-worklist.md). Every row navigates to the same
 * destination — the Target Source ops screen — so the bucket is a filter over
 * one list, not four containers. The 대상 cell borrows the pipelines dashboard
 * identity grammar (`TargetCell`) verbatim, so the two screens that open the
 * same Target Source read the same way.
 *
 * The card header owns the bucket's description and the refresh action. It
 * deliberately does NOT repeat the bucket's count — the number lives on the
 * tile above, once.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { getAlertTargetSources } from '@/app/lib/api/task-queue';
import type { AlertTargetKind, RequestListRow } from '@/lib/types/task-queue';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { TerraformLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { DashRow, RowAction, TargetCell } from '@/app/admin/pipelines/_dashboard/cells';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';

export type AlertStageIcon = IconName | 'terraform';

/** Contract default page size (`/dashboard/target-sources/{kind}` size=10). */
const PAGE_SIZE = 10;

const worklist = {
  /** Same surface the stage cards wore (r12 · border-strong · shadow-md). */
  card: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border-strong)] rounded-[12px] shadow-[var(--pl-shadow-md)] overflow-hidden',
  /** No bottom border of its own — the table's 2px header rule is the divider. */
  header: 'flex items-center gap-3 px-5 pt-4 pb-3',
  titleIcon: 'flex-none text-[var(--pl-text-medium)]',
  titleText: 'flex-none text-[20px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]',
  desc: 'min-w-0 flex-1 truncate text-[14px] leading-[1.5] text-[var(--pl-gray-600)]',
  descText: 'block max-w-[52ch] truncate text-[14px] text-[var(--pl-text-medium)]',
  state: 'px-5 py-12 text-center text-[12px] text-[var(--pl-text-weak)]',
  /** Skeleton bar — opsStyles.skeleton grammar at one text line's height. */
  skeletonBar: 'block h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  footer: 'px-5 py-3',
} as const;

export interface AlertWorklistProps {
  kind: AlertTargetKind;
  label: string;
  description: string;
  icon: AlertStageIcon;
  /** The bucket's summary count — sizes the loading skeleton to the real
   *  footprint so the card doesn't collapse when the rows arrive. */
  count: number;
  /** Bumped by the parent when the header refresh re-reads the summary. */
  reloadKey: number;
  /** Refresh both this list and the parent's summary/nav counts. */
  onRefresh: () => void;
}

export function AlertWorklist({
  kind,
  label,
  description,
  icon,
  count,
  reloadKey,
  onRefresh,
}: AlertWorklistProps): ReactElement {
  const router = useRouter();
  const [rows, setRows] = useState<RequestListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${page}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const list = await getAlertTargetSources(kind, page, PAGE_SIZE, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRows(list.content);
        setTotalPages(Math.max(1, list.totalPages));
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
        setFailed(true);
      }
      if (!controller.signal.aborted) setLoadedKey(loadKey);
    })();
    return () => controller.abort();
  }, [kind, page, loadKey]);

  const d = pipelineStyles.dashboard;

  return (
    <section className={worklist.card} aria-label={`${label} 대상 목록`}>
      <div className={worklist.header}>
        {icon === 'terraform' ? (
          <TerraformLogo size={20} />
        ) : (
          <Icon name={icon} size={20} className={worklist.titleIcon} />
        )}
        <h2 className={worklist.titleText}>{label}</h2>
        <p className={worklist.desc} title={description}>
          {description}
        </p>
        <PlButton variant="outline" size="sm" onClick={onRefresh} className="flex-none gap-1.5">
          <Icon name="refresh" size="md" />
          새로고침
        </PlButton>
      </div>

      <table className={d.table}>
        <thead>
          <tr>
            <th className={cn(d.th, 'w-[38ch]')}>대상</th>
            <th className={d.th}>설명</th>
            <th className={d.th} />
          </tr>
        </thead>
        <tbody className={d.body}>
          {failed ? (
            <tr>
              <td colSpan={3} className={worklist.state}>
                목록을 불러오지 못했습니다.
              </td>
            </tr>
          ) : loading ? (
            // Skeleton in the real column widths AND the real row count (the
            // tile already knows it), so nothing shifts on arrival.
            Array.from({ length: Math.min(Math.max(count, 1), PAGE_SIZE) }, (_, row) => (
              <tr key={row} aria-hidden="true">
                <td className={d.cell}>
                  <span className={worklist.skeletonBar} />
                </td>
                <td className={d.cell}>
                  <span className={worklist.skeletonBar} />
                </td>
                <td className={d.actionCell} />
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={3} className={worklist.state}>
                해당 단계의 대상이 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <DashRow
                key={row.targetSourceId}
                onActivate={() =>
                  router.push(passRoutes.pipelines.ops.targetSource(String(row.targetSourceId)))
                }
              >
                <td className={d.cell}>
                  <TargetCell
                    name={row.serviceName ?? '—'}
                    code={row.serviceCode ?? '—'}
                    targetId={String(row.targetSourceId ?? '—')}
                    provider={row.cloudProvider ?? ''}
                  />
                </td>
                <td className={d.cell}>
                  <span className={worklist.descText} title={row.description ?? undefined}>
                    {row.description ?? '—'}
                  </span>
                </td>
                <td className={d.actionCell}>
                  <RowAction />
                </td>
              </DashRow>
            ))
          )}
        </tbody>
      </table>

      <div className={worklist.footer}>
        <OpsPagination page={page} totalPages={totalPages} onChange={setPage} always />
      </div>
    </section>
  );
}
