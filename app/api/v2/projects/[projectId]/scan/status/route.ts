import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
      { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: SCAN_ERROR_CODES.NOT_FOUND.message },
      { status: SCAN_ERROR_CODES.NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: SCAN_ERROR_CODES.FORBIDDEN.message },
      { status: SCAN_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. 현재 스캔 상태 확인
  const activeScan = await dataAdapter.getLatestScanForProject(projectId);

  let currentScan = null;
  let isScanning = false;

  if (activeScan) {
    const updated = await dataAdapter.calculateScanStatus(activeScan);
    if (updated.status === 'PENDING' || updated.status === 'IN_PROGRESS') {
      isScanning = true;
      currentScan = {
        scanId: updated.id,
        status: updated.status,
        startedAt: updated.startedAt,
        progress: updated.progress,
      };
    }
  }

  // 5. 마지막 완료된 스캔 조회
  const { history } = await dataAdapter.getScanHistory(projectId, 1, 0);
  const lastCompletedScan = history.length > 0 ? {
    scanId: history[0].scanId,
    completedAt: history[0].completedAt,
    result: history[0].result,
  } : null;

  // 6. 스캔 가능 여부 확인
  const scanability = await dataAdapter.canScan(project);

  return NextResponse.json({
    isScanning,
    canScan: scanability.canScan,
    canScanReason: scanability.reason,
    cooldownUntil: scanability.cooldownUntil,
    currentScan,
    lastCompletedScan,
  });
}
