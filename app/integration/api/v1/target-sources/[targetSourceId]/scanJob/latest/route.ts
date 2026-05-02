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
    scanStatus: data.scan_status,
    targetSourceId: data.target_source_id,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    scanVersion: data.scan_version || 1,
    scanProgress: data.scan_progress,
    durationSeconds: data.duration_seconds,
    resourceCountByResourceType: data.resource_count_by_resource_type || {},
    scanError: data.scan_error,
  });
}, { expectedDuration: '50ms' });
