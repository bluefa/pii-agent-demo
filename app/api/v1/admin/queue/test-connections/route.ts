import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { toTestConnectionStatusPage } from '@/lib/types/task-queue';

// The contract restricts this filter to the two queue tabs.
const ALLOWED_STATUS = new Set(['TEST_CONNECTION_COMPLETED', 'TEST_CONNECTION_REJECTED']);

// GET /admin/queue/test-connections?status=&page=&size=
// Test Connection queue (P4). `status` is required. Contract default size = 10.
export const GET = withV1(async (request, { requestId }) => {
  const params = new URL(request.url).searchParams;
  const status = params.get('status');
  if (!status || !ALLOWED_STATUS.has(status)) {
    return problemResponse(
      createProblem(
        'INVALID_PARAMETER',
        'status는 TEST_CONNECTION_COMPLETED 또는 TEST_CONNECTION_REJECTED여야 합니다.',
        requestId,
      ),
    );
  }
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);

  const raw = schemas.PageTestConnectionRejectStatusResponse.parse(
    await bff.taskQueue.getTestConnectionPage({ status, page, size }),
  );
  return NextResponse.json(toTestConnectionStatusPage(raw));
});
