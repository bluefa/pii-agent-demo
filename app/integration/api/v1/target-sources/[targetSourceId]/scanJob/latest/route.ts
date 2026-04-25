import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.scan.getStatus(parsed.value);

  return NextResponse.json({
    id: data.id,
    scanStatus: data.scanStatus,
    targetSourceId: data.targetSourceId,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    scanVersion: data.scanVersion || 1,
    scanProgress: data.scanProgress,
    durationSeconds: data.durationSeconds,
    resourceCountByResourceType: data.resourceCountByResourceType || {},
    scanError: data.scanError,
  });
}, { expectedDuration: '50ms' });
