import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §4 (owner paste 2026-09-30).
// POST …/collaboration-channel/retry, no body → 202 Accepted, no body: ONE more creation
// attempt is queued (not created; `retry_expires_at` is not reset). The 403/404/409/503
// codes propagate as BffError → ProblemDetails with the code intact.
//
// The browser gets 202 with a JSON `null` rather than an empty body: `fetchJson` parses
// every 2xx except 204, and an empty body would turn the accepted request into a
// PARSE_ERROR on the client.
export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);
  await bff.ops.postCollaborationChannelRetry(parsed.value);
  return NextResponse.json(null, { status: 202 });
});
