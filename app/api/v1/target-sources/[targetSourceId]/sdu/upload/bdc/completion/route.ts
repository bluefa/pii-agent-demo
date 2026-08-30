import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import type { SduBdcCompletionRequestWire } from '@/lib/types/sdu';

// ASSUMED CONTRACT — docs/bff-api/requests/2026-08-30-sdu-bdc-completion.md §1.
// PUT …/sdu/upload/bdc/completion { completed } → 204 — BDC 구축 완료 단언.
//
// 경로가 §5 응답의 블록 이름을 그대로 따라간다 — `GET /upload` 가 `bdc` 라고 부르는 것을
// 쓰기도 그렇게 부른다. 되돌리기에 두 번째 경로를 만들지 않는 이유는 확인 답변이 두 경로인
// 이유의 뒷면이다: 저기서는 사실이 둘이었고 여기서는 하나이며 값이 둘이다.
//
// 권한(ADMIN 전용, 델타 §2)은 상류가 판정한다 — 이 라우트는 모양만 본다.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as SduBdcCompletionRequestWire | null;
  if (typeof body?.completed !== 'boolean') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'completed는 boolean이어야 합니다.', requestId),
    );
  }

  await bff.sdu.putBdcCompletion(parsed.value, body);
  return new NextResponse(null, { status: 204 });
});
