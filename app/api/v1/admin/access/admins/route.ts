import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §6.

// GET /admin/access/admins?page=&size= — 관리자 목록
export const GET = withV1(async (request) => {
  const query = new URL(request.url).searchParams;
  const page = Number(query.get('page') ?? 0);
  const size = Number(query.get('size') ?? 10);
  return NextResponse.json(await bff.access.listAdmins(page, size));
});

// POST /admin/access/admins — 관리자 권한 부여 (일괄), body { emails }
export const POST = withV1(async (request) => {
  const body = (await request.json()) as { emails?: unknown };
  const emails = Array.isArray(body.emails)
    ? body.emails.filter((email): email is string => typeof email === 'string')
    : [];
  return NextResponse.json(await bff.access.grantAdmins(emails));
});
