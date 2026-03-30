import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import type { ScanStatus, ScanResult, ResourceType } from '@/lib/types';

function extractResourceCounts(result: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  const r = result as ScanResult | null;
  if (r?.byResourceType) {
    for (const { resourceType, count } of r.byResourceType) {
      counts[resourceType as ResourceType] = count;
    }
  }
  return counts;
}

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.scan.getStatus(resolved.projectId);
  if (!response.ok) return response;

  const data = await response.json() as {
    id: number;
    scan_status: string;
    target_source_id: number;
    created_at: string;
    updated_at: string;
    scan_version: number | null;
    scan_progress: number | null;
    duration_seconds: number;
    resource_count_by_resource_type: Record<string, number> | null;
    scan_error: string | null;
  };

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

  return problemResponse(
    createProblem('TARGET_SOURCE_NOT_FOUND', '스캔 작업 이력이 없습니다.', requestId),
  );
}, { expectedDuration: '50ms' });
