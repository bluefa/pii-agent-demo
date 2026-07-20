import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { toTestConnectionStatusRow } from '@/lib/types/task-queue';

// GET …/test-connection/status (single) — Test Connection detail header (P5).
// Route owns the wire→camel boundary (ADR-019, lib/types/task-queue.ts).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = schemas.TestConnectionRejectStatusResponse.parse(
    await bff.taskQueue.getTestConnectionStatus(parsed.value),
  );
  return NextResponse.json(toTestConnectionStatusRow(raw));
});
