import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// swagger: POST /target-sources/{id}/scan → ScanJobResponse (snake, 202).
export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body: unknown = await request.json().catch(() => ({}));
  const raw = await bff.scan.create(parsed.value, body);

  return NextResponse.json(schemas.ScanJobResponse.parse(raw), { status: 202 });
}, { expectedDuration: '30000ms' });
