import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import type { VerifyTfRoleRequest } from '@/lib/types';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json()) as VerifyTfRoleRequest;
  return client.aws.verifyTfRole(body);
}, { expectedDuration: '30000ms' });
