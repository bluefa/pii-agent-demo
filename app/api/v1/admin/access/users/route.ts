import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §7.
// GET /admin/access/users?query=&exclude_service_code=&role= — 부여 피커용 검색.
// install-v1's /user/search cannot serve this: it filters ADMINs out (so it can
// never feed the 관리자 권한 picker) and cannot exclude "already on this service".
export const GET = withV1(async (request) => {
  const query = new URL(request.url).searchParams;
  return NextResponse.json(
    await bff.access.searchUsers({
      query: query.get('query') ?? undefined,
      excludeServiceCode: query.get('exclude_service_code') ?? undefined,
      role: query.get('role') ?? undefined,
    }),
  );
});
