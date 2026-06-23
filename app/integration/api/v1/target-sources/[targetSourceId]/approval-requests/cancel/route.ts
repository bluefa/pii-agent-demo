import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeApprovalActionResponse } from '@/lib/approval-response';

// POST …/approval-requests/cancel → ApprovalActionResponseDto (swagger 1174).
// No body. Swagger now returns the action response directly, so the prior
// history re-fetch workaround is gone. Single casing boundary (ADR-019 D1).
export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.cancelApprovalRequest(parsed.value);
  return NextResponse.json(normalizeApprovalActionResponse(camelCaseKeys(data)));
});
