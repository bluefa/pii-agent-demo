import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { SDU_ERROR_CODES } from '@/lib/constants/sdu';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.UNAUTHORIZED.code, message: SDU_ERROR_CODES.UNAUTHORIZED.message },
      { status: SDU_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.NOT_FOUND.code, message: SDU_ERROR_CODES.NOT_FOUND.message },
      { status: SDU_ERROR_CODES.NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.FORBIDDEN.code, message: SDU_ERROR_CODES.FORBIDDEN.message },
      { status: SDU_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. SDU 프로젝트 확인
  if (project.cloudProvider !== 'SDU') {
    return NextResponse.json(
      { error: SDU_ERROR_CODES.NOT_SDU_PROJECT.code, message: SDU_ERROR_CODES.NOT_SDU_PROJECT.message },
      { status: SDU_ERROR_CODES.NOT_SDU_PROJECT.status }
    );
  }

  // 5. SDU 설치 상태 확인
  const result = await dataAdapter.checkSduInstallation(projectId);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
