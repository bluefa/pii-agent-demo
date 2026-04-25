import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const limit = searchParams.get('limit') || '20';
  const offset = searchParams.get('offset') || '0';

  const data = await bff.projects.history(parsed.value, { type, limit, offset });
  return NextResponse.json(data);
}, { expectedDuration: '300ms' });
