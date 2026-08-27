import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { z } from 'zod';

// GET …/test-connection/latest-success-results — the `latest-results` sibling read
// off the last SUCCESS run. 200 is the same ARRAY of per-resource logical-DB
// summaries; only the run it counts differs.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getLatestTestConnectionSuccessResultSummaries(parsed.value);
  return NextResponse.json(z.array(schemas.TestConnectionLatestResultSummaryResponse).parse(data));
}, { expectedDuration: '50ms' });
