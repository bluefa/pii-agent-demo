import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// POST /admin/access/permission-access/{requestId}/approve — 담당자 부여까지 한 트랜잭션.
// 204, 이미 처리된 건 400. 화면은 응답 본문이 없으므로 목록을 다시 읽는다.
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === 'string' ? body.message : '';
  await bff.access.approveRequest(Number(params.requestId), message);
  return new NextResponse(null, { status: 204 });
});
