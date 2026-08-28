import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

/**
 * POST /admin/ops/services/{serviceCode}/service-installed — 화면의 "서비스 PII Agent
 * 설치완료" 동작 (upstream `update-service-installed`).
 *
 * Upstream is `POST /install/v1/service-infos/{serviceCode}/update-service-installed`,
 * a bodyless write with no declared response body: the path is the whole request,
 * and success is the status. Nothing is parsed on the way back, so this route has
 * no DTO — docs/swagger/install-v1.yaml declares the pair as a bodyless 204.
 *
 * No role guard here. Authorization is the BFF's, matching every other admin route
 * under this tree (see the comment in app/admin/layout.tsx).
 */
export const POST = withV1(async (_request, { params }) => {
  await bff.ops.updateServiceInstalled(String(params.serviceCode));
  return NextResponse.json({ success: true });
});
