import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// POST /admin/permission-access/{requestId}/reject — 사유 필수, 204.
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason : '';
  await bff.access.rejectRequest(Number(params.requestId), reason);
  return new NextResponse(null, { status: 204 });
});
