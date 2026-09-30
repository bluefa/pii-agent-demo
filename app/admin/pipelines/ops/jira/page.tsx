/**
 * Ops console — Jira Ticket (auto-created tickets and watchers an admin has to finish).
 *
 * SSR like 운영 알림 (`ops/alerts/page.tsx`): the summary is awaited here for the tiles
 * and the default bucket, the list streams inside `Suspense`. 선택된 버킷과 페이지는
 * 주소의 것이다.
 *
 * The two counts ride the summary's passthrough (BE PR #8891, ahead of the swagger
 * drop — docs/api/ops-assumed-contracts.md §12). An absent count is **null, not 0**:
 * the same rule as 운영 알림, judged before `toDashboardSummary` folds it to 0.
 */
import { Suspense } from 'react';

import { bff } from '@/lib/bff/client';
import { redirectIfSessionExpired } from '@/lib/bff/session-expired';
import { schemas } from '@/lib/generated/install-v1';
import { isJiraAlertKind, toDashboardSummary } from '@/lib/types/task-queue';
import {
  EMPTY_JIRA_COUNTS,
  JIRA_BUCKETS,
  defaultJiraKind,
  jiraBucket,
  type JiraCounts,
} from '@/app/admin/pipelines/ops/jira/_components/jiraBuckets';
import { pageIndexFromParam } from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import { JiraHeader } from '@/app/admin/pipelines/ops/jira/_components/JiraHeader';
import { JiraWorklistSection } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklistSection';
import { JiraWorklistSkeleton } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';
import { PAGE_SIZE } from '@/app/admin/pipelines/ops/alerts/_components/worklistStyles';

export const dynamic = 'force-dynamic';

const loadCounts = async (): Promise<JiraCounts | null> => {
  try {
    const wire = schemas.DashboardSummaryResponse.parse(
      await bff.taskQueue.getDashboardSummary(),
    );
    // Undeclared on the generated schema — read off the passthrough before the fold.
    if (
      typeof wire.jira_ticket_failed_count !== 'number'
      || typeof wire.jira_watcher_failed_count !== 'number'
    ) {
      console.warn('[ops/jira] 요약에 빠진 건수가 있다 — 건수는 모른다고 그린다', wire);
      return null;
    }
    return toDashboardSummary(wire);
  } catch (err) {
    await redirectIfSessionExpired(err);
    console.warn('[ops/jira] 요약 조회 실패 — 건수는 모른다고 그린다', err);
    return null;
  }
};

export default async function OpsJiraPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const [{ kind: kindParam, page: pageParam }, counts] = await Promise.all([
    searchParams,
    loadCounts(),
  ]);

  const kind =
    kindParam && isJiraAlertKind(kindParam)
      ? kindParam
      : defaultJiraKind(counts ?? EMPTY_JIRA_COUNTS);
  const pageIndex = pageIndexFromParam(pageParam);
  const bucket = jiraBucket(kind);
  const total = counts
    ? JIRA_BUCKETS.reduce((sum, item) => sum + (item.count(counts) ?? 0), 0)
    : null;
  const bucketCount = counts ? (bucket.count(counts) ?? 0) : null;

  return (
    <div>
      <JiraHeader total={total} counts={counts} selected={kind} />

      <div className="mt-6">
        <Suspense
          key={`${kind}:${pageIndex}`}
          fallback={
            <JiraWorklistSkeleton
              kind={kind}
              label={bucket.label}
              owner={bucket.owner}
              icon={bucket.icon}
              count={bucketCount}
            />
          }
        >
          <JiraWorklistSection
            kind={kind}
            pageIndex={pageIndex}
            size={PAGE_SIZE}
            count={bucketCount}
          />
        </Suspense>
      </div>
    </div>
  );
}
