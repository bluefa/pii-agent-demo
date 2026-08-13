import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// GET /users/search?query=&excludeEmails= — 부여 피커용 검색.
// 실계약이 excludeIds→excludeEmails, UserInfo→UserSummary 로 바뀐 그 엔드포인트다.
// 이름이 없으므로 knox_id 와 email 로만 매칭한다.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const query = params.get('query') ?? undefined;
  const raw = params.get('excludeEmails');
  const excludeEmails = raw ? raw.split(',').map((v) => v.trim()).filter(Boolean) : [];
  return NextResponse.json(await bff.access.searchUsers(query, excludeEmails));
});
