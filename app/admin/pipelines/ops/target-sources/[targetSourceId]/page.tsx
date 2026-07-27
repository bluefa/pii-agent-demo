/**
 * Ops console — Target Source 운영 상세 route. Server shell parses the path id
 * and hands off to the client view. `params` is a Promise on this Next version.
 */
import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';

export default async function OpsTargetSourcePage({
  params,
}: {
  params: Promise<{ targetSourceId: string }>;
}) {
  const { targetSourceId } = await params;
  const id = Number(targetSourceId);
  if (!Number.isInteger(id) || id <= 0) {
    return <p className="text-[14px] text-[var(--pl-text-weak)]">잘못된 Target Source ID입니다.</p>;
  }
  return <OpsTargetView targetSourceId={id} />;
}
