import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /users/search?q= — 부여 피커용 검색. 응답이 UserSummary 로 바뀐 그 엔드포인트다.
// 이름이 없으므로 knox_id 와 email 로만 매칭한다.
// 이미 가진 사람 제외는 화면 몫 — 계약의 `excludeIds` 키잉이 미확정이다(E4).
export const GET = withV1(async (request) => {
  const q = new URL(request.url).searchParams.get('q') ?? undefined;
  return NextResponse.json(await bff.access.searchUsers(q));
});
