import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §1·§2. No install-v1
// backing; the wire passes through verbatim and app/lib/api/access.ts owns the
// snake→camel boundary (same split as the ops console's assumed reads).

// GET /admin/access/services/{serviceCode}/users?page=&size= — 담당자 목록
export const GET = withV1(async (request, { params }) => {
  const query = new URL(request.url).searchParams;
  const page = Number(query.get('page') ?? 0);
  const size = Number(query.get('size') ?? 10);
  return NextResponse.json(await bff.access.listServiceUsers(params.serviceCode, page, size));
});

// POST /admin/access/services/{serviceCode}/users — 직접 부여 (일괄), body { emails }
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json()) as { emails?: unknown };
  const emails = Array.isArray(body.emails)
    ? body.emails.filter((email): email is string => typeof email === 'string')
    : [];
  return NextResponse.json(await bff.access.grantServiceUsers(params.serviceCode, emails));
});
