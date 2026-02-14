import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import type { VerifyTfRoleRequest } from '@/lib/types';

export const POST = withV1(async (request, { requestId, params }) => {
  // Validate targetSourceId exists (Swagger requires target source context)
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const body = (await request.json()) as VerifyTfRoleRequest;
  return client.aws.verifyTfRole(body);
}, { expectedDuration: '30000ms' });
