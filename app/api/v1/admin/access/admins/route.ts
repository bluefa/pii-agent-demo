import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.

// GET /admin/access/admins — 관리자 전체 (페이지 아님)
export const GET = withV1(async () => {
  return NextResponse.json(await bff.access.listAdmins());
});

// POST /admin/access/admins — 관리자 권한 부여, body { email } (계약이 단수다)
export const POST = withV1(async (request) => {
  const body = (await request.json()) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email : '';
  return NextResponse.json(await bff.access.addAdmin(email));
});
