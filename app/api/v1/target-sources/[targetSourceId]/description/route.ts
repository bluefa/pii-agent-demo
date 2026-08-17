import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §8.
// PUT …/description { description: string }.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as { description?: unknown } | null;
  const description = body?.description;
  // 빈 문자열은 유효한 값이다 — 설명을 지우는 것도 편집이라, `!description` 으로
  // 걸러내면 "지우기"가 조용히 400 이 된다. 막는 것은 타입이 틀린 경우뿐.
  if (typeof description !== 'string') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'description은 문자열이어야 합니다.', requestId),
    );
  }

  const data = await bff.targetSources.putDescription(parsed.value, description);
  return NextResponse.json(data);
});
