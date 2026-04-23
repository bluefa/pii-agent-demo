import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.confirm.testConnection(String(parsed.value), {});
  if (!response.ok) return response;

  const data = await response.json() as { id?: string };

  return NextResponse.json(
    { success: true, id: data.id ?? requestId },
    { status: 202 },
  );
}, { expectedDuration: '600000ms' });
