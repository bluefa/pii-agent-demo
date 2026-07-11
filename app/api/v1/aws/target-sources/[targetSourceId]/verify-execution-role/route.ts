import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

// swagger: GET /target-sources/{id}/aws/verify-execution-role → AwsRoleVerificationResponse.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = await bff.aws.verifyExecutionRole(parsed.value);
  return NextResponse.json(schemas.AwsRoleVerificationResponse.parse(raw));
}, { expectedDuration: '30000ms' });
