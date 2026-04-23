import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  normalizeIssue222ApprovalActionResponse,
  normalizeIssue222ApprovalHistoryPage,
} from '@/lib/issue-222-approval';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = await request.json().catch(() => ({}));
  const response = await client.confirm.approveApprovalRequest(String(parsed.value), body);
  if (!response.ok) return response;

  const payload = await response.json();
  const historyResponse = await client.confirm.getApprovalHistory(String(parsed.value), 0, 1);
  if (historyResponse.ok) {
    const history = normalizeIssue222ApprovalHistoryPage(await historyResponse.json(), parsed.value);
    const latestResult = history.content[0]?.result;
    if (latestResult) {
      return NextResponse.json(latestResult);
    }
  }

  return NextResponse.json(
    normalizeIssue222ApprovalActionResponse(payload, { fallbackStatus: 'APPROVED' }),
  );
});
