import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /permission-access/mine?page=&size= — 내 요청 내역 (승인·반려 결과 포함).
//
// CONTRACT GAP — 초안 스펙에 아직 없는 두 가지 중 하나. 오너가 추가하기로 했고,
// 그때까지는 제안한 모양(상세와 같은 shape 의 페이지) 그대로다. `access_status` 만으로는
// 반려 사유도 처리 일시도 말할 수 없어 "승인 내역 조회" 요구사항이 성립하지 않는다.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listMyRequests(page, size));
});
