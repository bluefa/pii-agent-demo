import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

/**
 * POST /admin/ops/services/{serviceCode}/end-of-service — 화면의 "EOS 처리" 동작
 * (upstream `end-of-service`).
 *
 * Same shape as its sibling `service-installed`: upstream
 * `POST /install/v1/service-infos/{serviceCode}/end-of-service` is bodyless both
 * ways, so success is the status and there is no DTO to declare. Both paths were
 * declared by hand in docs/swagger/install-v1.yaml from the owner's spec.
 */
export const POST = withV1(async (_request, { params }) => {
  await bff.ops.endOfService(String(params.serviceCode));
  return NextResponse.json({ success: true });
});
