import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById } from '@/lib/mock-data';
import { getScanHistory, canScan, calculateScanStatus } from '@/lib/mock-scan';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';
import { getStore } from '@/lib/mock-store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
      { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = getProjectById(projectId);
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
  const store = getStore();
  const activeScan = store.scans.find(
    (s) => s.projectId === projectId && (s.status === 'PENDING' || s.status === 'IN_PROGRESS')
  );

  let currentScan = null;
  let isScanning = false;

  if (activeScan) {
    const updated = calculateScanStatus(activeScan);
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
  const { history } = getScanHistory(projectId, 1, 0);
  const lastCompletedScan = history.length > 0 ? {
    scanId: history[0].scanId,
    completedAt: history[0].completedAt,
    result: history[0].result,
  } : null;

  // 6. 스캔 가능 여부 확인
  const scanability = canScan(project);

  return NextResponse.json({
    isScanning,
    canScan: scanability.canScan,
    canScanReason: scanability.reason,
    currentScan,
    lastCompletedScan,
  });
}
