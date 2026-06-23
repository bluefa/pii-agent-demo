import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeTestConnectionVersionResult } from '@/lib/test-connection-response';

// GET …/test-connection/latest_version — polling endpoint. Single casing
// boundary (ADR-019 D1): camelCaseKeys + normalizer, no silent `as T`.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getTestConnectionLatest(parsed.value);
  return NextResponse.json(normalizeTestConnectionVersionResult(camelCaseKeys(data)));
}, { expectedDuration: '50ms' });
