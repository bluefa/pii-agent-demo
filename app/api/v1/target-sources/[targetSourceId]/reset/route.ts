import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

/** swagger TargetSourceResetRequestDto.reason 의 maxLength. */
const REASON_MAXLEN = 1000;

// POST …/reset — 연동 상태 초기화 (Step 7 인프라 변경 → 1단계, swagger 1114).
// Body = TargetSourceResetRequestDto { reason }.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = schemas.TargetSourceResetRequestDto.parse(await request.json().catch(() => ({})));
  // 계약은 reason 을 required 로 두지만 생성된 zod 는 enum·required 를 벗겨 `.partial()` 로
  // 나오므로(ADR-019 LOOSE), 빈 몸통도 그대로 통과한다. 초기화는 끝난 설치와 승인을 버리는
  // 조작이고 사유는 그 감사 기록이다 — 화면이 입력을 강제하는 것과 별개로, 경계가 직접 막는다.
  const reason = body.reason?.trim();
  if (!reason) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'reason 은 비어 있지 않은 문자열이어야 합니다.', requestId),
    );
  }
  if (reason.length > REASON_MAXLEN) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', `reason 은 ${REASON_MAXLEN}자를 넘을 수 없습니다.`, requestId),
    );
  }

  const data = await bff.confirm.resetTargetSource(parsed.value, { reason });
  return NextResponse.json(schemas.ApprovalActionResponseDto.parse(data));
});
