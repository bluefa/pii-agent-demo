import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  normalizeApprovalRequestBody,
  normalizeApprovalRequestSummary,
  normalizeProcessStatusResponse,
} from '@/lib/approval-bff';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawBody = await request.json().catch(() => ({}));
  const body = normalizeApprovalRequestBody(rawBody);
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
    const issueStatus = normalizeProcessStatusResponse(
      await bff.confirm.getProcessStatus(parsed.value),
      { target_source_id: parsed.value },
    );
    if (issueStatus.process_status === 'CONFIRMING') {
      fallbackStatus = 'AUTO_APPROVED';
    }
  } catch (error) {
    if (!(error instanceof BffError)) throw error;
    // best-effort: on upstream failure, fall back to PENDING
  }

  const finalPayload = normalizeApprovalRequestSummary(payload, {
    targetSourceId: parsed.value,
    fallbackStatus,
    fallbackTotalCount: resourceTotalCount,
    fallbackSelectedCount: resourceSelectedCount,
  });

  return NextResponse.json(finalPayload, { status: 200 });
});
