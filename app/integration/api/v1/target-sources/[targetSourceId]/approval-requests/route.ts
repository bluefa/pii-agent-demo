import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  normalizeIssue222ApprovalRequestBody,
  normalizeIssue222ApprovalRequestSummary,
  normalizeIssue222ProcessStatusResponse,
} from '@/lib/issue-222-approval';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const rawBody = await request.json().catch(() => ({}));
  const body = normalizeIssue222ApprovalRequestBody(rawBody);
  const response = await client.confirm.createApprovalRequest(resolved.projectId, body);
  if (!response.ok) return response;

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
  const statusResponse = await client.confirm.getProcessStatus(resolved.projectId);
  if (statusResponse.ok) {
    const issueStatus = normalizeIssue222ProcessStatusResponse(await statusResponse.json(), {
      target_source_id: parsed.value,
    });
    if (issueStatus.process_status === 'CONFIRMING') {
      fallbackStatus = 'AUTO_APPROVED';
    }
  }

  const payload = normalizeIssue222ApprovalRequestSummary(await response.json(), {
    targetSourceId: parsed.value,
    fallbackStatus,
    fallbackTotalCount: resourceTotalCount,
    fallbackSelectedCount: resourceSelectedCount,
  });

  return NextResponse.json(payload, { status: 200 });
});
