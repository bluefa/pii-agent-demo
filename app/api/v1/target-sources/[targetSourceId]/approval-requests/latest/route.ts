import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// GET …/approval-requests/latest — Step2 승인 대기 카드 + 반영 배너.
export const GET = withV1(async (_request, { params, requestId }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getApprovalRequestLatest(parsed.value);
  return NextResponse.json(schemas.ApprovalRequestLatestDto.parse(data));
});
