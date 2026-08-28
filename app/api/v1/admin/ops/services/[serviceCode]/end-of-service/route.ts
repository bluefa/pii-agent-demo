import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

/**
 * POST /admin/ops/services/{serviceCode}/end-of-service — 서비스 종료.
 *
 * Same shape as its sibling `service-installed`: upstream
 * `POST /install/v1/service-infos/{serviceCode}/end-of-service` is bodyless both
 * ways, so success is the status and there is no DTO to declare. Neither path is
 * in docs/swagger/install-v1.yaml yet.
 */
export const POST = withV1(async (_request, { params }) => {
  await bff.ops.endOfService(String(params.serviceCode));
  return NextResponse.json({ success: true });
});
