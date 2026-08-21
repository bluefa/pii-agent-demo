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
import { redirect } from 'next/navigation';

import { passRoutes } from '@/lib/routes';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toAlertListPage, type AlertListRow, type AlertTargetKind } from '@/lib/types/task-queue';
import { alertBucket } from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import { AlertWorklist } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklist';

export async function AlertWorklistSection({
  kind,
  pageIndex,
  size,
  count,
}: {
  kind: AlertTargetKind;
  pageIndex: number;
  size: number;
  /** 요약이 말한 이 버킷의 건수 — 메타 줄이 싣는다. 목록 한 페이지는 최대 10건이라
   *  행을 세어서는 전체 건수를 알 수 없다. null 이면 요약을 못 읽었다는 뜻이다. */
  count: number | null;
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

  /**
   * 범위 밖 페이지는 마지막 페이지로 되돌린다.
   *
   * 주소가 공유되는 화면이라 `?page=99` 같은 링크가 실제로 도착한다. 그 응답은 빈
   * content 를 주므로 화면은 "해당 단계의 대상이 없습니다"를 그리는데, 대상은 있고
   * 페이지 번호만 틀린 것이라 거짓말이 된다. 되돌릴 자리는 응답이 온 뒤에야 알므로
   * 이 판정은 fetch 위로 올릴 수 없다.
   *
   * try 밖인 이유: `redirect()` 는 특수 에러를 던져 흐름을 넘기므로, 위 catch 안에서
   * 부르면 그 catch 가 자기 이동을 삼켜 조회 실패로 둔갑시킨다.
   */
  if (!failed && pageIndex >= totalPages) {
    redirect(`${passRoutes.pipelines.ops.alerts}?kind=${kind}&page=${totalPages}`);
  }

  return (
    <AlertWorklist
      kind={kind}
      label={bucket.label}
      owner={bucket.owner}
      count={count}
      icon={bucket.icon}
      tab={bucket.tab}
      rows={rows}
      page={pageIndex}
      totalPages={totalPages}
      failed={failed}
    />
  );
}
