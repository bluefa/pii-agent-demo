/**
 * Ops console — Target Source 운영 상세 route. Server shell parses the path id
 * and the `?tab=` deep link, then hands off to the client view. `params` and
 * `searchParams` are Promises on this Next version.
 *
 * The tab is read HERE rather than with useSearchParams in the client view, so
 * the view needs no Suspense boundary and the first paint already shows the
 * linked tab (no flash of 진행 상태).
 */
import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';
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
  return <OpsTargetView targetSourceId={id} initialTab={opsTabLabel(tab)} />;
}
