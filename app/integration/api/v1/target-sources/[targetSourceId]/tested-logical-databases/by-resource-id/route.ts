import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// GET …/tested-logical-databases/by-resource-id?resourceId=… — discovered DB/Schema
// from the last Test Connection (left panel). The CSR client owns the single camel
// boundary, so the BFF response is forwarded as raw snake (ADR-019 D1/D8).
export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resourceId = new URL(request.url).searchParams.get('resourceId');
  if (!resourceId) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', 'resourceId 쿼리 파라미터가 필요합니다.', requestId),
    );
  }

  const data = await bff.logicalDb.getTestedByResourceId(parsed.value, resourceId);
  return NextResponse.json(data);
}, { expectedDuration: '50ms' });
