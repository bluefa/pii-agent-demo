import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §4.
// GET /admin/access/requests?status=&page=&size= — 접근 권한 요청 목록
export const GET = withV1(async (request) => {
  const query = new URL(request.url).searchParams;
  const status = query.get('status') ?? undefined;
  const page = Number(query.get('page') ?? 0);
  const size = Number(query.get('size') ?? 10);
  return NextResponse.json(await bff.access.listRequests(status, page, size));
});
