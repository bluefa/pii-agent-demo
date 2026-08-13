import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /user/services/page?query=&page=&size= — 전체 서비스 + access_status.
//
// 기존 `/api/v1/user/services/page` 와 같은 업스트림을 보지만 투영이 다르다: 그쪽은
// 스웨거 계약(PageServiceItem)으로 파싱해 access_status 를 버리고, 이쪽은 그 필드를
// 읽는다. 요청 가능한 서비스 = access_status 가 NONE 이거나 REJECTED 인 것들.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get('query') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listUserServices(query, page, size));
});
