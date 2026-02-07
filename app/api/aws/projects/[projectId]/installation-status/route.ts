import { NextRequest, NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

type RouteParams = { params: Promise<{ projectId: string }> };

/**
 * GET /api/aws/projects/{projectId}/installation-status
 * AWS 설치 상태 조회
 */
export const GET = async (
  _request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { projectId } = await params;

    // 프로젝트 존재 확인
    const project = await dataAdapter.getProjectById(projectId);

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

    // 설치 상태 조회 (없으면 초기화)
    let status = await dataAdapter.getInstallationStatus(projectId);

    if (!status) {
      // 프로젝트의 TF 권한 여부에 따라 초기화
      // Service TF 완료 여부로 TF 권한 판단
      const hasTfPermission = project.terraformState.serviceTf === 'COMPLETED';
      status = await dataAdapter.initializeInstallation(projectId, hasTfPermission);
    }

    return NextResponse.json(status);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
