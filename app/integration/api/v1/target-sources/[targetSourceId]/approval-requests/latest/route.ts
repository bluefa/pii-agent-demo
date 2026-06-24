import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { camelCaseKeys } from '@/lib/object-case';
import { normalizeApprovalRequestLatest } from '@/lib/approval-response';

// GET …/approval-requests/latest — Step2 승인 대기 카드 + 반영 배너.
// Single casing boundary (ADR-019 D1): camelCaseKeys + normalizer.
export const GET = withV1(async (_request, { params, requestId }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.confirm.getApprovalRequestLatest(parsed.value);
  return NextResponse.json(normalizeApprovalRequestLatest(camelCaseKeys(data)));
});
