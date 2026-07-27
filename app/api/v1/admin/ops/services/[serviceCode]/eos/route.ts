import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §6.
// POST /admin/ops/services/{serviceCode}/eos { force } — 409 while a pipeline
// is running and force is false.
export const POST = withV1(async (request, { requestId, params }) => {
  const body: unknown = await request.json().catch(() => null);
  const force = (body as { force?: unknown } | null)?.force;
  if (typeof force !== 'boolean') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'force는 boolean이어야 합니다.', requestId),
    );
  }
  const data = await bff.ops.postServiceEos(String(params.serviceCode), force);
  return NextResponse.json(data);
});
