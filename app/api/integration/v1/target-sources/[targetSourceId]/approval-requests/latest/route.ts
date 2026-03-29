import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeIssue222ApprovalHistoryPage } from '@/lib/issue-222-approval';

const createNotFoundProblem = (requestId: string): NextResponse =>
  NextResponse.json({
    type: 'https://pii-agent.dev/problems/NOT_FOUND',
    title: 'Not Found',
    status: 404,
    detail: '승인 요청 이력이 없습니다.',
    code: 'NOT_FOUND',
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

  const response = await client.confirm.getApprovalHistory(resolved.projectId, 0, 1);
  if (!response.ok) return response;

  const payload = normalizeIssue222ApprovalHistoryPage(await response.json(), parsed.value);
  const latest = payload.content[0];

  if (!latest) {
    return createNotFoundProblem(requestId);
  }

  return NextResponse.json(latest);
});
