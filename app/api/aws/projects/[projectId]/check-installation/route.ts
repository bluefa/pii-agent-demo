import { NextRequest, NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

type RouteParams = { params: Promise<{ projectId: string }> };

/**
 * POST /api/aws/projects/{projectId}/check-installation
 * AWS 설치 상태 확인 (Refresh)
 */
export const POST = async (
  request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { projectId } = await params;

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

    const body = await request.json().catch(() => ({})) as { scriptId?: string };

    let result = await dataAdapter.checkInstallation(projectId, body.scriptId);

    if (!result) {
      const hasTfPermission = project.terraformState.serviceTf === 'COMPLETED';
      await dataAdapter.initializeInstallation(projectId, hasTfPermission);
      result = await dataAdapter.checkInstallation(projectId, body.scriptId);
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
