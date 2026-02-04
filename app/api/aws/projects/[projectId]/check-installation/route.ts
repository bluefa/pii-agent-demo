import { NextRequest, NextResponse } from 'next/server';
import { checkInstallation, initializeInstallation } from '@/lib/mock-installation';
import { getProjectById } from '@/lib/mock-data';

type RouteParams = { params: Promise<{ projectId: string }> };

/**
 * POST /api/aws/projects/{projectId}/check-installation
 * AWS 설치 상태 확인 (Refresh)
 */
export const POST = async (
  _request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { projectId } = await params;

    // 프로젝트 존재 확인
    const project = getProjectById(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (project.cloudProvider !== 'AWS') {
      return NextResponse.json(
        { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
        { status: 400 }
      );
    }

    // 설치 상태가 없으면 초기화
    let result = checkInstallation(projectId);

    if (!result) {
      const hasTfPermission = project.terraformState.serviceTf === 'COMPLETED';
      initializeInstallation(projectId, hasTfPermission);
      result = checkInstallation(projectId);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
