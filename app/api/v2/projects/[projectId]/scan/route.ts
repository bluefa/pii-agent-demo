import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';

export async function POST(
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

  // 4. 요청 바디 파싱
  let force = false;
  try {
    const body = await request.json();
    force = body.force === true;
  } catch {
    // 빈 바디 허용
  }

  // 5. 스캔 유효성 검증
  const validation = await dataAdapter.validateScanRequest(project, force);
  if (!validation.valid) {
    const response: Record<string, unknown> = {
      error: validation.errorCode,
      message: validation.errorMessage,
    };
    if (validation.existingScanId) {
      response.scanId = validation.existingScanId;
    }
    return NextResponse.json(response, { status: validation.httpStatus });
  }

  // 6. 스캔 작업 생성
  const scanJob = await dataAdapter.createScanJob(project);

  // 7. 응답 (202 Accepted)
  const estimatedDuration = Math.ceil(
    (new Date(scanJob.estimatedEndAt).getTime() - new Date(scanJob.startedAt).getTime()) / 1000
  );

  return NextResponse.json(
    {
      scanId: scanJob.id,
      status: 'STARTED',
      startedAt: scanJob.startedAt,
      estimatedDuration,
    },
    { status: 202 }
  );
}
