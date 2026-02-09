import { NextRequest, NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

type RouteParams = { params: Promise<{ projectId: string; scriptId: string }> };

/**
 * GET /api/aws/projects/{projectId}/terraform-scripts/{scriptId}
 * 특정 TF 스크립트 다운로드 URL 조회 (Manual mode 전용)
 */
export const GET = async (
  _request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { projectId, scriptId } = await params;

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

    let status = await dataAdapter.getInstallationStatus(projectId);

    if (!status) {
      status = await dataAdapter.initializeInstallation(projectId, false);
    }

    if (status.hasTfPermission) {
      return NextResponse.json(
        { error: 'NOT_AVAILABLE', message: 'TF 권한이 있어 스크립트가 필요하지 않습니다.' },
        { status: 400 }
      );
    }

    const result = await dataAdapter.getTerraformScriptDownload(projectId, scriptId);

    if (!result) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '해당 스크립트를 찾을 수 없습니다.' },
        { status: 404 }
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
