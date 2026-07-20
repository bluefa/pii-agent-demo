import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// PUT …/approval-requests/nlb-indices — override the NLB index for a single
// resource of the latest PENDING IDC approval request. Body is the single
// { resource_id, nlb_index } NlbIndexAssignmentDto (api-spec G5: per-row save).
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = schemas.NlbIndexAssignmentDto.parse(await request.json().catch(() => ({})));
  const data = await bff.taskQueue.putNlbIndex(parsed.value, body);
  return NextResponse.json(data);
});
