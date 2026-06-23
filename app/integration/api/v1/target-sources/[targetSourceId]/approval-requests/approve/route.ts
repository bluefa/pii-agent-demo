import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeApprovalActionResponse } from '@/lib/approval-response';

// POST …/approval-requests/approve → ApprovalActionResponseDto (swagger 1244).
// Single casing boundary (ADR-019 D1): camelCaseKeys + normalizer.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = await request.json().catch(() => ({}));
  const data = await bff.confirm.approveApprovalRequest(parsed.value, body);
  return NextResponse.json(normalizeApprovalActionResponse(camelCaseKeys(data)));
});
