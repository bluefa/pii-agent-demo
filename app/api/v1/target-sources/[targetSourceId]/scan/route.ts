import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const POST = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const body: unknown = await request.json().catch(() => ({}));
  const response = await client.scan.create(resolved.projectId, body);
  if (!response.ok) return response;

  const legacy = await response.json() as {
    scanId: string;
    status: string;
    startedAt: string;
    estimatedDuration: number;
  };

  return NextResponse.json({
    id: Number(legacy.scanId.replace(/\D/g, '')) || 1,
    scanStatus: 'SCANNING',
    targetSourceId: parsed.value,
    createdAt: legacy.startedAt,
    updatedAt: legacy.startedAt,
    scanVersion: 1,
    scanProgress: null,
    durationSeconds: 0,
    resourceCountByResourceType: {},
    scanError: null,
  }, { status: 202 });
}, { expectedDuration: '30000ms', errorFormat: 'flat' });
