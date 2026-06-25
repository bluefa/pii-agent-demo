import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import type { z } from 'zod';

// GET …/excluded-databases/by-resource-id?resourceId=… — the current skip policy
// (right panel). Validated with schemas.SkipLogicalDatabaseResponse.parse(raw).
export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resourceId = new URL(request.url).searchParams.get('resourceId');
  if (!resourceId) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', 'resourceId 쿼리 파라미터가 필요합니다.', requestId),
    );
  }

  const data = await bff.logicalDb.getExcludedByResourceId(parsed.value, resourceId);
  return NextResponse.json(schemas.SkipLogicalDatabaseResponse.parse(data));
}, { expectedDuration: '50ms' });

// PUT …/excluded-databases/by-resource-id?resourceId=… — full replace of the skip
// policy. The body is authored snake by the CSR client and forwarded verbatim (D3).
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resourceId = new URL(request.url).searchParams.get('resourceId');
  if (!resourceId) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', 'resourceId 쿼리 파라미터가 필요합니다.', requestId),
    );
  }

  const body = (await request.json()) as z.infer<typeof schemas.UpdateSkipLogicalDatabaseRequest>;
  const data = await bff.logicalDb.updateExcludedByResourceId(parsed.value, resourceId, body);
  return NextResponse.json(schemas.SkipLogicalDatabaseResponse.parse(data));
});
