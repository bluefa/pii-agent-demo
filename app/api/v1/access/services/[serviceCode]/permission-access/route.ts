import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md (사용자 API).
// POST /services/{serviceCode}/permission-access — 권한 요청, body { reason }. 204.
// 멱등: 이미 PENDING 이면 그대로 두고 성공으로 답한다. `/admin/**` 밖에 있어야
// 권한이 없는 사용자가 호출할 수 있다.
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json()) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason : '';
  await bff.access.createRequest(params.serviceCode, reason);
  return new NextResponse(null, { status: 204 });
});
