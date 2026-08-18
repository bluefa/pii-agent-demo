import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §9.
// 업스트림은 값을 경로에 싣는다 (…/support-raw-data/enabled | /disabled). 내부 경로는
// 한 자리에 boolean 하나로 받는다 — 조작이 둘이 아니라 값이 둘이고, 경로 인코딩은
// 업스트림의 표현이라 그 변환은 bff 층 한 곳에만 둔다.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as { enabled?: unknown } | null;
  const enabled = body?.enabled;
  if (typeof enabled !== 'boolean') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'enabled는 boolean이어야 합니다.', requestId),
    );
  }

  await bff.targetSources.setDoesSupportRaw(parsed.value, enabled);
  // 업스트림이 응답 본문을 선언하지 않는다 — 호출부는 상세를 다시 읽으므로 지어내지 않는다.
  return new NextResponse(null, { status: 204 });
});
