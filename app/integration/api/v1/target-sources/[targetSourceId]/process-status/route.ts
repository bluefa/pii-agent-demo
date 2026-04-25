import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { client } from '@/lib/api-client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeIssue222ProcessStatusResponse, type Issue222ProcessStatus } from '@/lib/issue-222-approval';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';
import { ProcessStatus } from '@/lib/types';

const toIssue222ProcessStatus = (processStatus: ProcessStatus): Issue222ProcessStatus => {
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

  const rawStatus = normalizeIssue222ProcessStatusResponse(
    await bff.confirm.getProcessStatus(parsed.value),
    { target_source_id: parsed.value },
  );

  // targetSources.get migration is in adr011-02 scope — keep legacy client here.
  const projectResponse = await client.targetSources.get(String(parsed.value));
  if (!projectResponse.ok) {
    return NextResponse.json(rawStatus);
  }

  const project = extractTargetSource(await projectResponse.json() as TargetSourceDetailResponse);

  return NextResponse.json({
    ...rawStatus,
    process_status: toIssue222ProcessStatus(project.processStatus),
  });
});
