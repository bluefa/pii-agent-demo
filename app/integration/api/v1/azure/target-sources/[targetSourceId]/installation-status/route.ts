import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { buildV1Response } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';
import type { LegacyInstallationStatus, LegacyVmInstallationStatus } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.azure.getInstallationStatus(resolved.projectId);
  if (!response.ok) return response;

  const dbStatus = await response.json() as LegacyInstallationStatus;

  return NextResponse.json(buildV1Response(dbStatus, null));
});
