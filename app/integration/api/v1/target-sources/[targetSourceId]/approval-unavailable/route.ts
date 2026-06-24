import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeApprovalUnavailableResponse } from '@/lib/approval-response';

// POST …/approval-unavailable → ApprovalUnavailableResponseDto (swagger 876).
// Body: ApprovalRejectRequestDto { reason } (required). Single casing boundary.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = await request.json().catch(() => ({}));
  const data = await bff.confirm.markApprovalRequestUnavailable(parsed.value, body);
  return NextResponse.json(normalizeApprovalUnavailableResponse(camelCaseKeys(data)));
});
