import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { buildV1Response } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const dbStatus = await bff.azure.getInstallationStatus(parsed.value);
  return NextResponse.json(buildV1Response(dbStatus, null));
});
