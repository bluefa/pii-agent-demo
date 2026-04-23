import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
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

  const response = await client.scan.getStatus(String(parsed.value));
  if (!response.ok) return response;

  const data = await response.json() as {
    id: number;
    scanStatus: string;
    targetSourceId: number;
    createdAt: string;
    updatedAt: string;
    scanVersion: number | null;
    scanProgress: number | null;
    durationSeconds: number;
    resourceCountByResourceType: Record<string, number> | null;
    scanError: string | null;
  };

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
