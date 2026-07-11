import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// swagger: GET /target-sources/{id}/scanJob/latest → ScanJobResponse (snake, verbatim).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = await bff.scan.getStatus(parsed.value);
  return NextResponse.json(schemas.ScanJobResponse.parse(raw));
}, { expectedDuration: '50ms' });
