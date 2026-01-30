import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById } from '@/lib/mock-data';
import { getScanJob } from '@/lib/mock-scan';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; scanId: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
      { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId, scanId } = await params;

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

  // 4. 스캔 조회 (시간 기반 상태 계산 포함)
  const scan = getScanJob(scanId);
  if (!scan || scan.projectId !== projectId) {
    return NextResponse.json(
      { error: 'SCAN_NOT_FOUND', message: SCAN_ERROR_CODES.SCAN_NOT_FOUND.message },
      { status: SCAN_ERROR_CODES.SCAN_NOT_FOUND.status }
    );
  }

  return NextResponse.json({
    scanId: scan.id,
    projectId: scan.projectId,
    provider: scan.provider,
    status: scan.status,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt,
    progress: scan.progress,
    result: scan.result,
    error: scan.error,
  });
}
