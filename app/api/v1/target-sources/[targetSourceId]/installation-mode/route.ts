import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §2.
// PUT …/installation-mode { grant_service_terraform_execution_permission: boolean }.
// 응답은 void 다(오너 확인 2026-09-07) — 성사 여부는 HTTP 상태만이 말한다.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as
    | { grant_service_terraform_execution_permission?: unknown }
    | null;
  const grant = body?.grant_service_terraform_execution_permission;
  if (typeof grant !== 'boolean') {
    return problemResponse(
      createProblem(
        'VALIDATION_FAILED',
        'grant_service_terraform_execution_permission는 boolean이어야 합니다.',
        requestId,
      ),
    );
  }

  await bff.ops.putInstallationMode(parsed.value, grant);
  // 업스트림이 본문을 주지 않는다 — 방금 보낸 값을 되돌려 지어내지 않는다.
  return new NextResponse(null, { status: 204 });
});
