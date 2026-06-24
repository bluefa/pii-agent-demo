import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeApprovalRequestSummary } from '@/lib/approval-response';
// ADR-019: out-of-contract request shape, pending BFF — swagger
// ApprovalRequestInputDto is { resources: TargetSourceResourceItemDto[] } but the
// current selection UI assembles { resource_inputs: [...] }. Option (B) per
// D-approval §2.1: keep the legacy request body for this phase, migrate the
// response only. Switch the body to `resources` once the BFF confirms it.
import { normalizeApprovalRequestBody } from '@/lib/approval-bff';

// POST …/approval-requests → ApprovalRequestSummaryDto (swagger 1022; 200, not 201).
// Single casing boundary (ADR-019 D1): camelCaseKeys + normalizer on the response.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawBody = await request.json().catch(() => ({}));
  const body = normalizeApprovalRequestBody(rawBody);
  const data = await bff.confirm.createApprovalRequest(parsed.value, body);

  return NextResponse.json(normalizeApprovalRequestSummary(camelCaseKeys(data)), {
    status: 200,
  });
});
