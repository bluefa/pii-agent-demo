import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// POST …/test-connection/async — no request body; optional collectorImageTag query
// (ADR-019 zod-codegen). Route validates raw BFF response.
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const collectorImageTag = new URL(request.url).searchParams.get('collectorImageTag') ?? undefined;

  const data = await bff.confirm.testConnection(parsed.value, collectorImageTag);
  return NextResponse.json(schemas.TestConnectionTriggerResponse.parse(data), { status: 202 });
}, { expectedDuration: '600000ms' });
