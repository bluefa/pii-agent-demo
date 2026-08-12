import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §8.
// GET /access/requestable-services?query=&page=&size=
// NOT under /admin — a user with no permission is exactly who calls this.
// `/user/services/page` returns the complement (what the caller already holds).
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get('query') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);
  return NextResponse.json(await bff.access.listRequestableServices(query, page, size));
});
