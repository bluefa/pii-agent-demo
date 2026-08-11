import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// POST …/reset — 연동 상태 초기화 (Step 7 인프라 변경 → 1단계, swagger 1114).
// Body = TargetSourceResetRequestDto { reason } (UI enforces maxLength 1000).
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = schemas.TargetSourceResetRequestDto.parse(await request.json().catch(() => ({})));
  const data = await bff.confirm.resetTargetSource(parsed.value, body);
  return NextResponse.json(schemas.ApprovalActionResponseDto.parse(data));
});
