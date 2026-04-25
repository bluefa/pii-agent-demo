import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { buildV1Response } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';
import type { LegacyVmInstallationStatus } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  // DB: check (새로고침), VM: check (새로고침)
  const dbStatus = await bff.azure.checkInstallation(parsed.value);

  // VM 상태 새로고침 — BffError만 무시 (DB 결과만 반환). 비BffError는 propagate.
  let vmStatus: LegacyVmInstallationStatus | null = null;
  try {
    vmStatus = await bff.azure.vmCheckInstallation(parsed.value);
  } catch (e) {
    if (!(e instanceof BffError)) throw e;
    console.warn(`[azure check-installation] vm check failed: ${e.code} (${e.status}) ${e.message}`);
  }

  return NextResponse.json(buildV1Response(dbStatus, vmStatus));
});
