import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// GET …/test-connection/pod-logs/{podId} — TC pod 로그. 업스트림은 target source 로
// 스코프되지 않는 `GET /install/v1/logs/{podId}` 라 targetSourceId 는 이 내부 경로에서만
// 쓰인다(형식 검증). 응답([{timestamp, content, severity}])은 swagger 미랜딩이라 검증할
// 스키마가 없다 — 원문 그대로 통과시키고, 계약이 랜딩하면 schemas.X.parse 로 조인다.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getTestConnectionPodLog(parsed.value, params.podId);
  return NextResponse.json(data);
}, { expectedDuration: '50ms' });
