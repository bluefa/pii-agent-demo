import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §2.
// PUT …/installation-mode { grant_service_terraform_execution_permission: boolean }.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as
    | { grant_service_terraform_execution_permission?: unknown }
    | null;
  const grant = body?.grant_service_terraform_execution_permission;
  if (typeof grant !== 'boolean') {
    return problemResponse(
      createProblem(
        'VALIDATION_FAILED',
        'grant_service_terraform_execution_permission는 boolean이어야 합니다.',
        requestId,
      ),
    );
  }

  const data = await bff.ops.putInstallationMode(parsed.value, grant);
  return NextResponse.json(data);
});
