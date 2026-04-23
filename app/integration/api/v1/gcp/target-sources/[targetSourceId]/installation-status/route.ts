import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import { transformInstallationStatus } from '../_lib/transform';
import type { LegacyGcpInstallationStatus } from '../_lib/transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.gcp.getInstallationStatus(String(parsed.value));
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyGcpInstallationStatus;
  return NextResponse.json(transformInstallationStatus(legacy));
});
