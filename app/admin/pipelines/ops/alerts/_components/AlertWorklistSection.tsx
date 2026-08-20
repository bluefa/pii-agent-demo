/**
 * 선택된 버킷의 한 페이지를 서버에서 읽어 표에 넘기는 Server Component.
 *
 * 페이지(`page.tsx`)와 떨어져 있는 이유는 `Suspense` 경계가 **이 fetch 하나**만
 * 감싸야 하기 때문이다. 요약과 같은 컴포넌트에서 await 하면 목록이 늦을 때 타일까지
 * 함께 늦고, 버킷을 바꿀 때마다 머리글이 통째로 스켈레톤이 된다.
 *
 * 실패는 빈 목록이 아니다 — 여기서 잡아 `failed` 로 넘기고, 표가 "불러오지 못했습니다"를
 * 그린다. throw 하면 error.tsx 가 화면 전체를 대체해 타일까지 사라진다.
 */
import type { ReactElement } from 'react';

import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toAlertListPage, type AlertListRow, type AlertTargetKind } from '@/lib/types/task-queue';
import { alertBucket } from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import { AlertWorklist } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklist';

export async function AlertWorklistSection({
  kind,
  pageIndex,
  size,
}: {
  kind: AlertTargetKind;
  pageIndex: number;
  size: number;
}): Promise<ReactElement> {
  const bucket = alertBucket(kind);

  let rows: AlertListRow[] = [];
  let totalPages = 1;
  let failed = false;
  try {
    const list = toAlertListPage(
      schemas.PageTargetSourceInfo.parse(
        await bff.taskQueue.getAlertTargetSources({ kind, page: pageIndex, size }),
      ),
    );
    rows = list.content;
    totalPages = Math.max(1, list.totalPages);
  } catch (err) {
    console.error(`[ops/alerts] ${kind} 목록 조회 실패`, err);
    failed = true;
  }

  return (
    <AlertWorklist
      kind={kind}
      label={bucket.label}
      description={bucket.description}
      icon={bucket.icon}
      tab={bucket.tab}
      rows={rows}
      page={pageIndex}
      totalPages={totalPages}
      failed={failed}
    />
  );
}
