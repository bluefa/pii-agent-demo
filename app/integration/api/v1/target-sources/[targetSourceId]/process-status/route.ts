import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import type { z } from 'zod';

type BffApprovalProcessStatus = NonNullable<z.infer<typeof schemas.ProcessStatusResponseDto>['process_status']>;

// Maps TargetSourceDetail.process_status (snake enum from target-sources GET) to the
// ProcessStatusResponseDto vocab. Both use the same enum values so this is direct.
const toProcessStatus = (process_status: string | undefined): BffApprovalProcessStatus => {
  switch (process_status) {
    case 'PENDING':    return 'PENDING';
    case 'CONFIRMING': return 'CONFIRMING';
    case 'CONFIRMED':  return 'CONFIRMED';
    case 'INSTALLED':  return 'INSTALLED';
    case 'CONNECTED':  return 'CONNECTED';
    case 'COMPLETED':  return 'COMPLETED';
    default:           return 'IDLE';
  }
};

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawStatus = schemas.ProcessStatusResponseDto.parse(
    await bff.confirm.getProcessStatus(parsed.value),
  );

  let projectProcessStatus: string | undefined;
  try {
    const detail = schemas.TargetSourceDetail.parse(await bff.targetSources.get(parsed.value));
    projectProcessStatus = detail.process_status;
  } catch (e) {
    if (!(e instanceof BffError)) throw e;
    // Project lookup is auxiliary — fall back to rawStatus from process-status BFF.
  }

  if (projectProcessStatus === undefined) {
    return NextResponse.json(rawStatus);
  }

  return NextResponse.json({
    ...rawStatus,
    process_status: toProcessStatus(projectProcessStatus),
  });
});
