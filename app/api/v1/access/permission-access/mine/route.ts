import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /permission-access/mine?status=&page=&size= — 내 요청 내역.
//
// 업스트림은 `GET /user/permission-access` 다 — 2026-08-14 에 실구현되면서 갭 B4 가
// 닫혔다. 경로에 남은 `mine` 은 그전에 우리가 제안했던 이름으로, 내부 프록시 주소일
// 뿐 계약과는 무관하다.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const status = params.get('status') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listMyRequests(status, page, size));
});
