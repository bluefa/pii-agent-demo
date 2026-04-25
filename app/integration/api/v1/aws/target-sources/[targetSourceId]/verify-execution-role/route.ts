import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = await request.json().catch(() => ({})) as { roleArn?: string };
  const result = await bff.aws.verifyTfRole(parsed.value, body);
  return NextResponse.json(result);
}, { expectedDuration: '30000ms' });
