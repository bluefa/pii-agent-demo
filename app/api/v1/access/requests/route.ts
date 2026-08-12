import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §9·§10. Requester-side,
// so deliberately NOT under /admin.

// GET /access/requests?page=&size= — 내 요청 내역 (승인·반려 결과 포함)
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);
  return NextResponse.json(await bff.access.listMyRequests(page, size));
});

// POST /access/requests — 권한 요청 생성 (중복/보유 시 409)
export const POST = withV1(async (request) => {
  const body = (await request.json()) as { service_code?: unknown; reason?: unknown };
  const serviceCode = typeof body.service_code === 'string' ? body.service_code : '';
  const reason = typeof body.reason === 'string' ? body.reason : '';
  return NextResponse.json(await bff.access.createRequest(serviceCode, reason));
});
