import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  return client.services.settings.gcp.get(resolved.project.serviceCode);
});
