import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.projects.credentials(resolved.projectId);
  if (!response.ok) return response;

  const data = (await response.json()) as { credentials: unknown[] };
  return NextResponse.json(data.credentials);
});
