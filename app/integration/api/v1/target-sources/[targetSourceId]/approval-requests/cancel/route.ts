import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  normalizeApprovalActionResponse,
  normalizeApprovalHistoryPage,
} from '@/lib/approval-bff';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const payload = await bff.confirm.cancelApprovalRequest(parsed.value);

  try {
    const history = normalizeApprovalHistoryPage(
      await bff.confirm.getApprovalHistory(parsed.value, 0, 1),
      parsed.value,
    );
    const latestResult = history.content[0]?.result;
    if (latestResult) {
      return NextResponse.json(latestResult);
    }
  } catch (error) {
    if (!(error instanceof BffError)) throw error;
    // best-effort: on upstream failure, fall back to the action response with fallbackStatus=CANCELLED
  }

  return NextResponse.json(
    normalizeApprovalActionResponse(payload, { fallbackStatus: 'CANCELLED' }),
  );
});
