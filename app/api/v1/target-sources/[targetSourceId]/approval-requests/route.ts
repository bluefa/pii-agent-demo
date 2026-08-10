import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { isMock } from '@/lib/env';

/**
 * Demo dial for the submit result frames — the failure path is unreachable against the
 * mock BFF, which always succeeds. Put `MOCK_APPROVAL_FAIL_RATE=0.5` in `.env.local` to
 * make one request in two answer with a 500 the modal can render.
 *
 * Gated on `isMock()`, not on the rate alone: a rate is an ordinary server env var, so a
 * stray value in a deploy config would otherwise drop real approval requests — and the
 * user would see the same failure frame a genuine outage produces. Mock vs real is one
 * decision in this codebase (`docs/api/boundaries.md`), and this rides it.
 */
const failRate = () => (isMock() ? Number(process.env.MOCK_APPROVAL_FAIL_RATE ?? 0) : 0);

// POST …/approval-requests → ApprovalRequestSummaryDto (swagger 1022; 200, not 201).
// Body is validated against ApprovalRequestInputDto (contract shape: { resources: TargetSourceResourceItemDto[] }).
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  if (Math.random() < failRate()) {
    return problemResponse(
      createProblem('INTERNAL_ERROR', '승인 요청 처리 중 오류가 발생했어요.', requestId),
    );
  }

  const rawBody = await request.json().catch(() => ({}));
  const body = schemas.ApprovalRequestInputDto.parse(rawBody);
  const data = await bff.confirm.createApprovalRequest(parsed.value, body);

  return NextResponse.json(schemas.ApprovalRequestSummaryDto.parse(data), { status: 200 });
});
