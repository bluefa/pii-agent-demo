import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §5.
// POST …/sdu/upload/firewall/refresh → the firewall block with a new `queried_at`.
// 목적지 IP 는 클라우드 사업자가 바꾸는 값이라, 다시 조회할 수 있어야 한다.
export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  return NextResponse.json(await bff.sdu.refreshFirewall(parsed.value));
});
