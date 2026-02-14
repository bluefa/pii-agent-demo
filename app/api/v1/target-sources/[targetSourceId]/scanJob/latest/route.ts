import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  // Swagger: getLatestScanJob returns ScanJob schema
  // Legacy client.scan.getStatus returns aggregated status — need to extract latest scan job
  const response = await client.scan.getStatus(resolved.projectId);
  if (!response.ok) return response;

  const status = await response.json() as {
    currentScan?: { scanId: string; status: string; startedAt: string; progress: number | null };
    lastCompletedScan?: { scanId: string; completedAt: string; result: unknown };
    isScanning: boolean;
  };

  // Return the most recent scan as ScanJob-like object
  if (status.currentScan) {
    return NextResponse.json({
      id: status.currentScan.scanId,
      scanStatus: status.currentScan.status === 'IN_PROGRESS' ? 'SCANNING' : status.currentScan.status,
      targetSourceId: parsed.value,
      createdAt: status.currentScan.startedAt,
      updatedAt: status.currentScan.startedAt,
      scanProgress: status.currentScan.progress,
    });
  }

  if (status.lastCompletedScan) {
    return NextResponse.json({
      id: status.lastCompletedScan.scanId,
      scanStatus: 'SUCCESS',
      targetSourceId: parsed.value,
      createdAt: status.lastCompletedScan.completedAt,
      updatedAt: status.lastCompletedScan.completedAt,
      scanProgress: null,
    });
  }

  // No scan records at all → 404 per Swagger
  return problemResponse(
    createProblem('TARGET_SOURCE_NOT_FOUND', '스캔 작업 이력이 없습니다.', requestId),
  );
}, { expectedDuration: '50ms' });
