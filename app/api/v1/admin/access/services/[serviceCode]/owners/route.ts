import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// 두 메서드 모두 ServiceOwnersResponse(전체 목록)를 돌려주므로 쓰기 뒤 재조회가 없다.

// GET /admin/access/services/{serviceCode}/owners — 권한 사용자 전체 (페이지 아님)
export const GET = withV1(async (_request, { params }) => {
  return NextResponse.json(await bff.access.listServiceOwners(params.serviceCode));
});

// POST /admin/access/services/{serviceCode}/owners — 직접 부여, body { emails }
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json()) as { emails?: unknown };
  const emails = Array.isArray(body.emails)
    ? body.emails.filter((email): email is string => typeof email === 'string')
    : [];
  return NextResponse.json(await bff.access.addServiceOwners(params.serviceCode, emails));
});
