/**
 * 선택된 버킷의 한 페이지를 서버에서 읽어 표에 넘기는 Server Component
 * (운영 알림의 `AlertWorklistSection` 과 같은 자리).
 *
 * 목록 행에는 티켓 상태가 없다 — 그래서 행마다 협업 채널을 따로 읽어 붙인다. 표의
 * 상태 태그·다음 시도·티켓 키와 모달의 링크가 전부 그 값에서 나온다.
 */
import type { ReactElement } from 'react';
import { redirect } from 'next/navigation';

import { passRoutes } from '@/lib/routes';
import { bff } from '@/lib/bff/client';
import { redirectIfSessionExpired } from '@/lib/bff/session-expired';
import { schemas } from '@/lib/generated/install-v1';
import { toJiraListPage, type JiraAlertKind } from '@/lib/types/task-queue';
import { WATCHER_PAGE_SIZE, toCollaborationChannel } from '@/lib/types/collaboration-channel';
import { jiraBucket } from '@/app/admin/pipelines/ops/jira/_components/jiraBuckets';
import { JiraWorklist, type JiraWorklistRow } from '@/app/admin/pipelines/ops/jira/_components/JiraWorklist';

export async function JiraWorklistSection({
  kind,
  pageIndex,
  size,
  count,
}: {
  kind: JiraAlertKind;
  pageIndex: number;
  size: number;
  count: number | null;
}): Promise<ReactElement> {
  const bucket = jiraBucket(kind);

  let rows: JiraWorklistRow[] = [];
  let totalPages = 1;
  let failed = false;
  try {
    const wire = schemas.PageTargetSourceInfo.parse(
      await bff.taskQueue.getAlertTargetSources({ kind, page: pageIndex, size }),
    );
    if (!Array.isArray(wire.content) || typeof wire.totalPages !== 'number') {
      throw new Error(
        `jira list envelope incomplete (content=${typeof wire.content}, totalPages=${typeof wire.totalPages})`,
      );
    }
    const list = toJiraListPage(wire);
    totalPages = Math.max(1, list.totalPages);

    // ponytail: one GET per row (≤10 per page); replace with list fields if BE adds
    // status to the list DTO. A failed GET is `channel: null` (조회 실패) for that row
    // only — the page never falls because one channel did.
    const channels = await Promise.allSettled(
      list.content.map((row) =>
        row.targetSourceId == null
          ? Promise.reject(new Error('no id'))
          : bff.ops.getCollaborationChannel(row.targetSourceId, { watcherSize: WATCHER_PAGE_SIZE }),
      ),
    );
    rows = list.content.map((row, index) => {
      const settled = channels[index];
      if (settled.status === 'rejected') {
        console.warn(`[ops/jira] ${row.targetSourceId} 협업 채널 조회 실패`, settled.reason);
      }
      return {
        ...row,
        channel: settled.status === 'fulfilled' ? toCollaborationChannel(settled.value) : null,
      };
    });
  } catch (err) {
    await redirectIfSessionExpired(err);
    console.error(`[ops/jira] ${kind} 목록 조회 실패`, err);
    failed = true;
  }

  // 범위 밖 페이지는 마지막 페이지로 — try 밖인 이유는 AlertWorklistSection 과 같다.
  if (!failed && pageIndex >= totalPages) {
    redirect(`${passRoutes.pipelines.ops.jira}?kind=${kind}&page=${totalPages}`);
  }

  return (
    <JiraWorklist
      kind={kind}
      label={bucket.label}
      owner={bucket.owner}
      count={count}
      icon={bucket.icon}
      rows={rows}
      page={pageIndex}
      totalPages={totalPages}
      failed={failed}
    />
  );
}
