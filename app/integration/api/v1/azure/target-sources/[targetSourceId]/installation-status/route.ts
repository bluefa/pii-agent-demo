import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { buildV1Response } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';
import type { AzureVmInstallationStatusResponse } from '@/lib/bff/types/azure';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const dbStatus = await bff.azure.getInstallationStatus(parsed.value);

  // VM status is best-effort (same as the check route): without it the VM
  // subnet/LB lifecycle is missing, so the phase cards + subnet/TF ActionCards
  // render wrong until a manual refresh. Swallow BffError (DB-only), propagate
  // unexpected errors so they still surface as 500.
  let vmStatus: AzureVmInstallationStatusResponse | null = null;
  try {
    vmStatus = await bff.azure.vmGetInstallationStatus(parsed.value);
  } catch (e) {
    if (!(e instanceof BffError)) throw e;
    console.warn(`[azure installation-status] vm status failed: ${e.code} (${e.status}) ${e.message}`);
  }

  return NextResponse.json(buildV1Response(dbStatus, vmStatus));
});
