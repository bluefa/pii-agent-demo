/**
 * Ops console — Target Source 운영 상세 route. Server shell parses the path id
 * and the `?tab=` deep link, then hands off to the client view. `params` and
 * `searchParams` are Promises on this Next version.
 *
 * The tab is read HERE rather than with useSearchParams in the client view, so
 * the view needs no Suspense boundary and the first paint already shows the
 * linked tab (no flash of 진행 상태).
 *
 * 연동 현황 카드만 서버가 그린다 (docs/api/boundaries.md Pipeline 2). 이 페이지는
 * 그 카드를 **await 하지 않는다** — 여기서 기다리면 첫 바이트가 그만큼 늦어 마스트헤드
 * 와 탭 줄까지 함께 붙잡힌다. `Suspense` 안에 두면 셸이 스켈레톤과 함께 먼저 나가고,
 * 카드는 같은 응답의 다음 청크로 따라붙는다 (`ops/alerts` 와 같은 배치).
 */
import { Suspense } from 'react';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';
import {
  StatusCard,
  StatusCardSkeleton,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/StatusCard';
import { opsTabLabel } from '@/lib/routes';

export default async function OpsTargetSourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ targetSourceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ targetSourceId }, { tab }] = await Promise.all([params, searchParams]);
  const id = Number(targetSourceId);
  if (!Number.isInteger(id) || id <= 0) {
    return <p className="text-[14px] text-[var(--pl-text-weak)]">잘못된 Target Source ID입니다.</p>;
  }
  return (
    <OpsTargetView
      targetSourceId={id}
      initialTab={opsTabLabel(tab)}
      statusSlot={
        <Suspense fallback={<StatusCardSkeleton />}>
          <StatusCard targetSourceId={id} />
        </Suspense>
      }
    />
  );
}
