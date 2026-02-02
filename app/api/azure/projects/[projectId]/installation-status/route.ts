import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById } from '@/lib/mock-data';
import { getAzureInstallationStatus } from '@/lib/mock-azure';
import { AZURE_ERROR_CODES } from '@/lib/constants/azure';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: AZURE_ERROR_CODES.UNAUTHORIZED.code, message: AZURE_ERROR_CODES.UNAUTHORIZED.message },
      { status: AZURE_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: AZURE_ERROR_CODES.NOT_FOUND.code, message: AZURE_ERROR_CODES.NOT_FOUND.message },
      { status: AZURE_ERROR_CODES.NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: AZURE_ERROR_CODES.FORBIDDEN.code, message: AZURE_ERROR_CODES.FORBIDDEN.message },
      { status: AZURE_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. Azure 설치 상태 조회
  const result = getAzureInstallationStatus(projectId);

  if (result.error) {
    return NextResponse.json(
      { error: result.error.code, message: result.error.message },
      { status: result.error.status }
    );
  }

  return NextResponse.json(result.data);
}
