import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toRequestListPage } from '@/lib/types/task-queue';

// GET /admin/queue/target-sources?confirmStatus=&targetSourceId=&page=&size=
// Approval request queue (P2) + single-target header lookup (P3). Contract
// default size = 10. Route normalizes the TargetSourceInfo camel island +
// latest_approval_request snake into one camel domain shape (api-spec G3).
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const confirmStatus = params.get('confirmStatus') ?? undefined;
  const targetSourceIdRaw = params.get('targetSourceId');
  const targetSourceId = targetSourceIdRaw ? Number(targetSourceIdRaw) : undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);

  const raw = schemas.PageTargetSourceInfo.parse(
    await bff.taskQueue.getTargetSourcesPage({ confirmStatus, targetSourceId, page, size }),
  );
  return NextResponse.json(toRequestListPage(raw));
});
