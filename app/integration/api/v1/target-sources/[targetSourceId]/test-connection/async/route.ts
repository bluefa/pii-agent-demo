import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// POST …/test-connection/async — no request body; optional collectorImageTag query.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const collectorImageTag = new URL(request.url).searchParams.get('collectorImageTag') ?? undefined;

  const data = await bff.confirm.testConnection(parsed.value, collectorImageTag);
  return NextResponse.json({ success: data.success }, { status: 202 });
}, { expectedDuration: '600000ms' });
