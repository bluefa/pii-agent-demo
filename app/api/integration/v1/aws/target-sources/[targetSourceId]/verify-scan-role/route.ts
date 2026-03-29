import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  return client.services.settings.aws.verifyScanRole(resolved.project.serviceCode);
}, { expectedDuration: '30000ms' });
