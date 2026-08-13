import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// GET /admin/permission-access?status=&page=&size= — 요청 목록 (기본 PENDING)
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const status = params.get('status') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listRequests(status, page, size));
});
