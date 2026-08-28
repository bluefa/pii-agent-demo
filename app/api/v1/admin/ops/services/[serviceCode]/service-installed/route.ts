import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

/**
 * POST /admin/ops/services/{serviceCode}/service-installed — 설치 상태 갱신.
 *
 * Upstream is `POST /install/v1/service-infos/{serviceCode}/update-service-installed`,
 * a bodyless write with no declared response body: the path is the whole request,
 * and success is the status. Nothing is parsed on the way back, so this route has
 * no DTO — the pair is not declared in docs/swagger/install-v1.yaml yet.
 *
 * No role guard here. Authorization is the BFF's, matching every other admin route
 * under this tree (see the comment in app/admin/layout.tsx).
 */
export const POST = withV1(async (_request, { params }) => {
  await bff.ops.updateServiceInstalled(String(params.serviceCode));
  return NextResponse.json({ success: true });
});
