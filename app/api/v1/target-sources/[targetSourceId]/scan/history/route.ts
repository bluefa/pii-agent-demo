import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  // Swagger uses page(0-based) + size; legacy uses limit/offset
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const offset = page * size;

  const response = await client.scan.getHistory(resolved.projectId, { limit: size, offset });
  if (!response.ok) return response;

  // Transform legacy { history, total } → Swagger { content, page }
  const data = await response.json() as { history: unknown[]; total: number };
  const totalElements = data.total;
  const totalPages = Math.ceil(totalElements / size);

  return NextResponse.json({
    content: data.history,
    page: {
      totalElements,
      totalPages,
      number: page,
      size,
    },
  });
});
