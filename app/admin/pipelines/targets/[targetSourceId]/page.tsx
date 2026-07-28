/**
 * Target detail route (C2-a) — now a REDIRECT to the ops console.
 *
 * The ops 인프라 작업 tab renders the same 현재 작업 + 작업 이력 sections (both go
 * through TargetPipelineSections) plus the Terraform status and every other
 * operational tab, so this standalone page had nothing of its own left.
 * Existing links (pipeline breadcrumb, service list) keep working through here.
 *
 * Temporary (307), not permanent: the route is meant to be deleted outright once
 * no inbound link points at it. `_components/TargetDetailView` is dead code as
 * of this change — left in place rather than removed in passing.
 */
import { redirect } from 'next/navigation';
import { passRoutes } from '@/lib/routes';

export default async function TargetDetailPage({
  params,
}: {
  params: Promise<{ targetSourceId: string }>;
}) {
  const { targetSourceId } = await params;
  redirect(passRoutes.pipelines.ops.targetSource(targetSourceId, 'infra'));
}
