import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §5.
// GET /admin/access/history?service_code=&type=&page=&size=
// `service_code` is the "서비스 코드 단위 이력 조회" axis; omit it for the global log.
export const GET = withV1(async (request) => {
  const query = new URL(request.url).searchParams;
  const serviceCode = query.get('service_code') ?? undefined;
  const type = query.get('type') ?? undefined;
  const page = Number(query.get('page') ?? 0);
  const size = Number(query.get('size') ?? 10);
  return NextResponse.json(await bff.access.listHistory({ serviceCode, type }, page, size));
});
