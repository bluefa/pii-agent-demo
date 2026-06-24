import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';

// swagger: GET /target-sources/{id}/aws/verify-scan-role → AwsRoleVerificationResponse.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.aws.verifyScanRole(parsed.value);
  return NextResponse.json(data);
}, { expectedDuration: '30000ms' });
