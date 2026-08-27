import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// GET …/test-connection/latest_success_version — the `latest_version` sibling that
// skips failed runs and answers with the last SUCCESS run. Same response DTO
// (TestConnectionVersionResult); only the run it points at differs.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getTestConnectionLatestSuccess(parsed.value);
  return NextResponse.json(schemas.TestConnectionVersionResult.parse(data));
}, { expectedDuration: '50ms' });
