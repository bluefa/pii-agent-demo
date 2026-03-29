import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const limit = searchParams.get('limit') || '20';
  const offset = searchParams.get('offset') || '0';

  return client.projects.history(resolved.projectId, { type, limit, offset });
}, { expectedDuration: '300ms' });
