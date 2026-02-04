import { NextRequest, NextResponse } from 'next/server';
import { getTerraformScript, getInstallationStatus, initializeInstallation } from '@/lib/mock-installation';
import { getProjectById } from '@/lib/mock-data';

type RouteParams = { params: Promise<{ projectId: string }> };

/**
 * GET /api/aws/projects/{projectId}/terraform-script
 * TF Script 다운로드 URL 조회
 */
export const GET = async (
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

    // 설치 상태 확인 (없으면 초기화)
    let status = getInstallationStatus(projectId);

    if (!status) {
      // TF 권한 없는 상태로 초기화 (스크립트 필요 케이스)
      status = initializeInstallation(projectId, false);
    }

    // TF 권한이 있으면 스크립트 불필요
    if (status.hasTfPermission) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', message: 'TF 권한이 있어 스크립트가 필요하지 않습니다.' },
        { status: 400 }
      );
    }

    const result = getTerraformScript(projectId);

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', message: '스크립트를 생성할 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
