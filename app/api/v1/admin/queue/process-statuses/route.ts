import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toProcessStatusPage } from '@/lib/types/task-queue';

// GET /admin/queue/process-statuses?processStatus=&targetSourceId=&page=&size=
// Process Status monitor. `processStatus`/`targetSourceId` are server-side filters
// (delay filters are client-side — api-spec gap G1). Contract default size = 20.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const processStatus = params.get('processStatus') ?? undefined;
  const targetSourceIdRaw = params.get('targetSourceId');
  const targetSourceId = targetSourceIdRaw ? Number(targetSourceIdRaw) : undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);

  const raw = schemas.PageProcessStatusCurrentResponse.parse(
    await bff.taskQueue.getProcessStatuses({ processStatus, targetSourceId, page, size }),
  );
  return NextResponse.json(toProcessStatusPage(raw));
});
