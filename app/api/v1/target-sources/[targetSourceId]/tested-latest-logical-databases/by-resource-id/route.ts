import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// GET …/tested-latest-logical-databases/by-resource-id?resourceId=… — discovered
// DB/Schema from the LATEST run, success or not. The `tested-logical-databases`
// sibling (no `-latest-`) is the last-SUCCESS one: the pair's names run opposite
// to the other two pairs, so read the segment, not the intuition.
// Same response DTO (TestedLogicalDatabasesResponse).
export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resourceId = new URL(request.url).searchParams.get('resourceId');
  if (!resourceId) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', 'resourceId 쿼리 파라미터가 필요합니다.', requestId),
    );
  }

  const data = await bff.logicalDb.getTestedLatestByResourceId(parsed.value, resourceId);
  return NextResponse.json(schemas.TestedLogicalDatabasesResponse.parse(data));
}, { expectedDuration: '50ms' });
