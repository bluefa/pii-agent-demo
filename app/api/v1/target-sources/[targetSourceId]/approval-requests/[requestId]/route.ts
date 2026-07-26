import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// GET …/approval-requests/{requestId} — swagger getApprovalRequestDetail.
// Per-request resources (대상/비대상) for the 승인 요청 상세 modal.
export const GET = withV1(async (_request, { params, requestId }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const approvalRequestId = Number(params.requestId);
  if (!Number.isInteger(approvalRequestId) || approvalRequestId < 0) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'requestId 는 정수여야 합니다.', requestId),
    );
  }

  const data = await bff.confirm.getApprovalRequestDetail(parsed.value, approvalRequestId);
  return NextResponse.json(schemas.ApprovalRequestDetailDto.parse(data));
});
