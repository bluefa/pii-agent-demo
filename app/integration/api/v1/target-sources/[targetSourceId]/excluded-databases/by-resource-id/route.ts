import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import type { UpdateSkipLogicalDatabaseRequestWire } from '@/lib/bff/types/logical-db';

// GET …/excluded-databases/by-resource-id?resourceId=… — the current skip policy
// (right panel). Raw snake forwarded; the CSR client camelCases (ADR-019 D1/D8).
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
  return NextResponse.json(data);
}, { expectedDuration: '50ms' });

// PUT …/excluded-databases/by-resource-id?resourceId=… — full replace of the skip
// policy. The body is authored snake by the CSR client and forwarded verbatim
// (no re-casing in the route, ADR-019 D3).
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resourceId = new URL(request.url).searchParams.get('resourceId');
  if (!resourceId) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', 'resourceId 쿼리 파라미터가 필요합니다.', requestId),
    );
  }

  const body = (await request.json()) as UpdateSkipLogicalDatabaseRequestWire;
  const data = await bff.logicalDb.updateExcludedByResourceId(parsed.value, resourceId, body);
  return NextResponse.json(data);
});
