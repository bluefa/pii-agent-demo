import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeTestConnectionLatestResultSummaries } from '@/lib/test-connection-response';

// GET …/test-connection/latest-results — 200 is an ARRAY of per-resource
// logical-DB summaries. camelCaseKeys maps each element; the normalizer types it.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getLatestTestConnectionResultSummaries(parsed.value);
  return NextResponse.json(normalizeTestConnectionLatestResultSummaries(camelCaseKeys(data)));
}, { expectedDuration: '50ms' });
