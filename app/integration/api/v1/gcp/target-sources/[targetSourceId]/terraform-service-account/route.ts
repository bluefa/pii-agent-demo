import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import type { GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.gcp.getTerraformServiceAccount(String(parsed.value));
  if (!response.ok) return response;

  const data = await response.json() as GcpServiceAccountInfo;
  return NextResponse.json(data);
});
