import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeApprovalUnavailableConfirmResponse } from '@/lib/approval-response';

// POST …/approval-unavailable/confirm → ApprovalUnavailableConfirmResponseDto
// (swagger 952). No body; resets the target source to its initial state.
// Single casing boundary (ADR-019 D1): camelCaseKeys + normalizer.
export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.confirmApprovalUnavailable(parsed.value);
  return NextResponse.json(
    normalizeApprovalUnavailableConfirmResponse(camelCaseKeys(data)),
  );
});
