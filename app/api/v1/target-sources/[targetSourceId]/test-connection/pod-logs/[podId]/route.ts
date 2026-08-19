import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// GET …/test-connection/pod-logs/{podId} — TC pod 로그 캡처본 (severity + content 리스트).
// DRAFT CONTRACT: swagger 미랜딩이라 검증할 스키마가 없다 — 원문 그대로 통과시키고,
// 계약이 랜딩하면 latest_version 라우트처럼 schemas.X.parse 로 조인다.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getTestConnectionPodLog(parsed.value, params.podId);
  return NextResponse.json(data);
}, { expectedDuration: '50ms' });
