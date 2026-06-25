import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { normalizeApprovalRequestBody } from '@/lib/approval-bff';

// POST …/approval-requests → ApprovalRequestSummaryDto (swagger 1022; 200, not 201).
// Contract gap: UI sends resource_inputs[], swagger ApprovalRequestInputDto has resources[].
// Body is forwarded verbatim (legacy shape maintained until BFF confirms contract).
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawBody = await request.json().catch(() => ({}));
  const body = normalizeApprovalRequestBody(rawBody);
  const data = await bff.confirm.createApprovalRequest(parsed.value, body);

  return NextResponse.json(schemas.ApprovalRequestSummaryDto.parse(data), { status: 200 });
});
