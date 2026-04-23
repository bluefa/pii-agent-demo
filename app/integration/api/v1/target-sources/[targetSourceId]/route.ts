import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { extractTargetSource } from '@/lib/target-source-response';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.targetSources.get(String(parsed.value));
  if (!response.ok) return response;

  const data = await response.json();
  return NextResponse.json(extractTargetSource(data));
}, { expectedDuration: '80ms ~ 300ms' });
