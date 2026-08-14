import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// POST /admin/admins/remove — 회수, body { email }. 마지막 관리자면 400.
export const POST = withV1(async (request) => {
  const body = (await request.json()) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email : '';
  await bff.access.removeAdmin(email);
  return new NextResponse(null, { status: 204 });
});
