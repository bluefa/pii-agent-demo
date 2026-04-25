import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  normalizeIssue222ApprovalRequestBody,
  normalizeIssue222ApprovalRequestSummary,
  normalizeIssue222ProcessStatusResponse,
} from '@/lib/issue-222-approval';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawBody = await request.json().catch(() => ({}));
  const body = normalizeIssue222ApprovalRequestBody(rawBody);
  const payload = await bff.confirm.createApprovalRequest(parsed.value, body);

  const resourceInputs = Array.isArray(body.resource_inputs) ? body.resource_inputs : [];
  const resourceTotalCount = resourceInputs.length;
  const resourceSelectedCount = resourceInputs.filter(
    (resourceInput) =>
      typeof resourceInput === 'object'
      && resourceInput !== null
      && 'selected' in resourceInput
      && resourceInput.selected === true,
  ).length;

  let fallbackStatus: 'PENDING' | 'AUTO_APPROVED' = 'PENDING';
  try {
    const issueStatus = normalizeIssue222ProcessStatusResponse(
      await bff.confirm.getProcessStatus(parsed.value),
      { target_source_id: parsed.value },
    );
    if (issueStatus.process_status === 'CONFIRMING') {
      fallbackStatus = 'AUTO_APPROVED';
    }
  } catch (error) {
    if (!(error instanceof BffError)) throw error;
    // best-effort: preserve "skip on upstream failure" semantics — fall back to PENDING
  }

  const finalPayload = normalizeIssue222ApprovalRequestSummary(payload, {
    targetSourceId: parsed.value,
    fallbackStatus,
    fallbackTotalCount: resourceTotalCount,
    fallbackSelectedCount: resourceSelectedCount,
  });

  return NextResponse.json(finalPayload, { status: 200 });
});
