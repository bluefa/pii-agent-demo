import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// POST …/test-connection/reject — request a Test Connection re-run (P5).
// Body = TestConnectionRejectRequest { reason } (UI enforces maxLength 512).
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = schemas.TestConnectionRejectRequest.parse(await request.json().catch(() => ({})));
  const data = await bff.taskQueue.rejectTestConnection(parsed.value, body);
  return NextResponse.json(schemas.TestConnectionRejectResponse.parse(data));
});
