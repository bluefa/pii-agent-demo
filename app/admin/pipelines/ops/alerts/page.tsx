/**
 * Ops console — 운영 알림 (action-needed target sources across all services).
 *
 * SSR (docs/api/boundaries.md Pipeline 2): this page reads the BFF itself
 * through `@/lib/bff/client` and hands finished data down. Nothing on this
 * screen fetches from the browser any more.
 *
 * What that buys, beyond the first paint arriving with data:
 *  - 선택된 버킷과 페이지가 **URL 의 것**이다. 운영자가 "설치 필요 2페이지"를 그대로
 *    붙여넣어 공유할 수 있고, 행을 열었다가 뒤로 가면 보던 목록으로 정확히 돌아온다.
 *    클라이언트 state 였을 때는 뒤로 가기가 항상 기본 버킷 1페이지로 떨어졌다.
 *  - 기본 버킷 판정(건수 있는 첫 버킷)이 요약과 같은 곳에서 끝난다. effect 가 고르던
 *    시절의 "아직 아무 버킷도 안 고른" 중간 상태가 사라진다.
 *
 * 두 fetch 는 분리해서 기다린다. 요약은 await 해서 타일과 기본 버킷을 정하고, 목록은
 * `Suspense` 안에서 스트리밍한다 — 버킷·페이지가 바뀔 때 머리글과 타일은 그대로 서 있고
 * 표 자리에만 스켈레톤이 든다(오늘 클라이언트 로딩이 하던 것과 같은 그림).
 */
import { Suspense } from 'react';

import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { isAlertTargetKind, toDashboardSummary } from '@/lib/types/task-queue';
import {
  ALERT_BUCKETS,
  EMPTY_ALERT_COUNTS,
  alertBucket,
  defaultAlertKind,
  pageIndexFromParam,
  type AlertCounts,
} from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import { AlertsHeader } from '@/app/admin/pipelines/ops/alerts/_components/AlertsHeader';
import { AlertWorklistSection } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklistSection';
import { AlertWorklistSkeleton } from '@/app/admin/pipelines/ops/alerts/_components/AlertWorklist';

/** 요약도 목록도 사용자마다·시점마다 다르다. 빌드 타임에 구울 것이 없다. */
export const dynamic = 'force-dynamic';

/** Contract default page size (`/dashboard/target-sources/{kind}` size=10). */
const PAGE_SIZE = 10;

/**
 * 요약을 못 읽으면 **null 이지 0 이 아니다**.
 *
 * 처음에는 실패를 `EMPTY_ALERT_COUNTS` 로 접었는데, 그러면 목록만 성공한 경우에 3 행이
 * 그려진 표 위에서 타일과 메타 줄이 나란히 "0"을 말한다 — 실패를 사실로 바꿔 말하는
 * 것이다. 실패는 빈 결과가 아니다: 모르면 모른다고 그리고(`—`), 건수 조각은 담당이
 * 없을 때처럼 그냥 빠진다.
 *
 * 요약 하나가 화면 전체를 내리지는 않는다 (ADR-008) — 아래 목록은 자기 실패를 따로
 * 말하고, 여기서 throw 하지 않는 이유도 그것이다.
 */
const loadCounts = async (): Promise<AlertCounts | null> => {
  try {
    return toDashboardSummary(
      schemas.DashboardSummaryResponse.parse(await bff.taskQueue.getDashboardSummary()),
    );
  } catch (err) {
    console.warn('[ops/alerts] 요약 조회 실패 — 건수는 모른다고 그린다', err);
    return null;
  }
};

export default async function OpsAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; page?: string }>;
}) {
  const [{ kind: kindParam, page: pageParam }, counts] = await Promise.all([
    searchParams,
    loadCounts(),
  ]);

  // 주소의 kind 가 계약 밖이면 기본 버킷으로 조용히 떨어진다 — 잘못된 링크는
  // 에러 화면이 아니라 기본 화면을 보여 주는 편이 운영자에게 낫다. 요약이 없으면
  // 고를 근거도 없으니 첫 버킷으로 간다.
  const kind =
    kindParam && isAlertTargetKind(kindParam)
      ? kindParam
      : defaultAlertKind(counts ?? EMPTY_ALERT_COUNTS);
  const pageIndex = pageIndexFromParam(pageParam);
  const bucket = alertBucket(kind);
  const total = counts
    ? ALERT_BUCKETS.reduce((sum, item) => sum + (item.count(counts) ?? 0), 0)
    : null;
  const bucketCount = counts ? (bucket.count(counts) ?? 0) : null;

  return (
    <div>
      <AlertsHeader total={total} counts={counts} selected={kind} />

      {/* key 가 버킷·페이지를 물고 있어야 다음 목록을 기다리는 동안 스켈레톤이 다시
          뜬다 — key 가 고정이면 새 데이터가 도착할 때까지 이전 버킷의 행이 남는다. */}
      <div className="mt-6">
        <Suspense
          key={`${kind}:${pageIndex}`}
          fallback={
            <AlertWorklistSkeleton
              label={bucket.label}
              owner={bucket.owner}
              icon={bucket.icon}
              count={bucketCount}
            />
          }
        >
          <AlertWorklistSection
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
