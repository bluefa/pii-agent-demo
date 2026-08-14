import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /services/page?query=&page=&size= — 전체 서비스 + 내 access_status + 담당자.
//
// `/user/services/page` 가 담당 서비스로 좁혀지면서(2026-08-14 오너 스펙) 갈라져 나온
// 목록이다. 신청 대상을 고르는 화면이 이쪽을 본다.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get('query') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listServicesPage(query, page, size));
});
