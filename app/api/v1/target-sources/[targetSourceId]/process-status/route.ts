import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// process_status is computed by the process-status BFF alone — the target-source
// payload no longer carries it, so this endpoint is the authoritative source.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawStatus = schemas.ProcessStatusResponseDto.parse(
    await bff.confirm.getProcessStatus(parsed.value),
  );

  return NextResponse.json(rawStatus);
});
