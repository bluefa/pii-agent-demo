import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeProcessStatusResponse, type BffApprovalProcessStatus } from '@/lib/approval-bff';
import { extractTargetSource } from '@/lib/target-source-response';
import { ProcessStatus } from '@/lib/types';

const toBffApprovalProcessStatus = (processStatus: ProcessStatus): BffApprovalProcessStatus => {
  switch (processStatus) {
    case ProcessStatus.WAITING_APPROVAL:
      return 'PENDING';
    case ProcessStatus.APPLYING_APPROVED:
      return 'CONFIRMING';
    case ProcessStatus.INSTALLING:
      return 'CONFIRMED';
    case ProcessStatus.WAITING_CONNECTION_TEST:
      return 'INSTALLED';
    case ProcessStatus.CONNECTION_VERIFIED:
      return 'CONNECTED';
    case ProcessStatus.INSTALLATION_COMPLETE:
      return 'COMPLETED';
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
    default:
      return 'IDLE';
  }
};

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const rawStatus = normalizeProcessStatusResponse(
    await bff.confirm.getProcessStatus(parsed.value),
    { target_source_id: parsed.value },
  );

  let projectStatus: ProcessStatus | null = null;
  try {
    const data = await bff.targetSources.get(parsed.value);
    projectStatus = extractTargetSource(data).processStatus;
  } catch (e) {
    if (!(e instanceof BffError)) throw e;
    // Project lookup is auxiliary — fall back to rawStatus from process-status BFF.
  }

  if (projectStatus === null) {
    return NextResponse.json(rawStatus);
  }

  return NextResponse.json({
    ...rawStatus,
    process_status: toBffApprovalProcessStatus(projectStatus),
  });
});
