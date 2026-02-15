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

  const status = await response.json() as {
    currentScan?: { scanId: string; status: ScanStatus; startedAt: string; progress: number | null };
    lastCompletedScan?: { scanId: string; status: ScanStatus; completedAt: string; result: unknown };
    isScanning: boolean;
  };

  if (status.currentScan) {
    return NextResponse.json({
      id: Number(status.currentScan.scanId.replace(/\D/g, '')) || 1,
      scanStatus: status.currentScan.status,
      targetSourceId: parsed.value,
      createdAt: status.currentScan.startedAt,
      updatedAt: status.currentScan.startedAt,
      scanVersion: 1,
      scanProgress: status.currentScan.progress,
      durationSeconds: 0,
      resourceCountByResourceType: {},
      scanError: null,
    });
  }

  if (status.lastCompletedScan) {
    return NextResponse.json({
      id: Number(status.lastCompletedScan.scanId.replace(/\D/g, '')) || 1,
      scanStatus: status.lastCompletedScan.status,
      targetSourceId: parsed.value,
      createdAt: status.lastCompletedScan.completedAt,
      updatedAt: status.lastCompletedScan.completedAt,
      scanVersion: 1,
      scanProgress: null,
      durationSeconds: 0,
      resourceCountByResourceType: extractResourceCounts(status.lastCompletedScan.result),
      scanError: null,
    });
  }

  return problemResponse(
    createProblem('TARGET_SOURCE_NOT_FOUND', '스캔 작업 이력이 없습니다.', requestId),
  );
}, { expectedDuration: '50ms', errorFormat: 'flat' });
