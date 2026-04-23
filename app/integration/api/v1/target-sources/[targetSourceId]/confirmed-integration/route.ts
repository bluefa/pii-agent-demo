import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeIssue222ConfirmedIntegration } from '@/lib/issue-222-approval';

const createNotFoundProblem = (requestId: string): NextResponse =>
  NextResponse.json({
    type: 'https://pii-agent.dev/problems/CONFIRMED_INTEGRATION_NOT_FOUND',
    title: 'Not Found',
    status: 404,
    detail: '확정된 연동 정보가 없습니다.',
    code: 'CONFIRMED_INTEGRATION_NOT_FOUND',
    retriable: false,
    requestId,
  }, {
    status: 404,
    headers: { 'content-type': 'application/problem+json' },
  });

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.confirm.getConfirmedIntegration(String(parsed.value));
  if (!response.ok) return response;

  const payload = normalizeIssue222ConfirmedIntegration(await response.json());
  if (payload.resource_infos.length === 0) {
    return createNotFoundProblem(requestId);
  }

  return NextResponse.json(payload);
});
