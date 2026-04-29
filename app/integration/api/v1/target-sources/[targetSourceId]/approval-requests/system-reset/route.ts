import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeApprovalActionResponse } from '@/lib/approval-bff';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const payload = await bff.confirm.systemResetApprovalRequest(parsed.value);

  return NextResponse.json(
    normalizeApprovalActionResponse(payload, { fallbackStatus: 'CANCELLED' }),
  );
});
