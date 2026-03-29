import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeIssue222ApprovedIntegration } from '@/lib/issue-222-approval';

const createNotFoundProblem = (requestId: string): NextResponse =>
  NextResponse.json({
    type: 'https://pii-agent.dev/problems/APPROVED_INTEGRATION_NOT_FOUND',
    title: 'Not Found',
    status: 404,
    detail: '승인된 연동 정보가 없습니다.',
    code: 'APPROVED_INTEGRATION_NOT_FOUND',
    retriable: false,
    requestId,
  }, {
    status: 404,
    headers: { 'content-type': 'application/problem+json' },
  });

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.confirm.getApprovedIntegration(resolved.projectId);
  if (!response.ok) {
    if (response.status === 404) {
      return createNotFoundProblem(requestId);
    }
    return response;
  }

  return NextResponse.json(normalizeIssue222ApprovedIntegration(await response.json()));
});
