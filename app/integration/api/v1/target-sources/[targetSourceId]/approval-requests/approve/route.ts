import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
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
  const payload = await bff.confirm.approveApprovalRequest(parsed.value, body);

  try {
    const history = normalizeIssue222ApprovalHistoryPage(
      await bff.confirm.getApprovalHistory(parsed.value, 0, 1),
      parsed.value,
    );
    const latestResult = history.content[0]?.result;
    if (latestResult) {
      return NextResponse.json(latestResult);
    }
  } catch (error) {
    if (!(error instanceof BffError)) throw error;
    // best-effort: on upstream failure, fall back to the action response with fallbackStatus=APPROVED
  }

  return NextResponse.json(
    normalizeIssue222ApprovalActionResponse(payload, { fallbackStatus: 'APPROVED' }),
  );
});
