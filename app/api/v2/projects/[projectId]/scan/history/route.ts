import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById } from '@/lib/mock-data';
import { getScanHistory } from '@/lib/mock-scan';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';

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

  // 4. 쿼리 파라미터 파싱
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // 5. 스캔 이력 조회
  const { history, total } = getScanHistory(projectId, limit, offset);

  return NextResponse.json({
    history: history.map((h) => ({
      scanId: h.scanId,
      status: h.status,
      startedAt: h.startedAt,
      completedAt: h.completedAt,
      duration: h.duration,
      result: h.result,
      error: h.error,
    })),
    total,
  });
}
