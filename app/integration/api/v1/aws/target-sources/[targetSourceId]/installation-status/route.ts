import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import type { LegacyAwsInstallationStatus } from '@/lib/types';
import { transformAwsInstallationStatus } from '@/app/integration/api/v1/aws/target-sources/_lib/installation-transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.aws.getInstallationStatus(String(parsed.value));
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyAwsInstallationStatus;
  return NextResponse.json(transformAwsInstallationStatus(legacy));
}, { expectedDuration: '5000ms' });
