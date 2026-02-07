import { NextRequest, NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import type { AwsInstallationMode } from '@/lib/types';

type RouteParams = { params: Promise<{ projectId: string }> };

interface SetInstallationModeRequest {
  mode: AwsInstallationMode;
}

/**
 * POST /api/aws/projects/{projectId}/installation-mode
 * AWS 설치 모드 선택 (AUTO/MANUAL)
 *
 * - AUTO: TF 권한 있음 (자동 설치)
 * - MANUAL: TF 권한 없음 (수동 설치)
 */
export const POST = async (
  request: NextRequest,
  { params }: RouteParams
) => {
  try {
    const { projectId } = await params;
    const body = await request.json() as SetInstallationModeRequest;

    // 요청 검증
    if (!body.mode || !['AUTO', 'MANUAL'].includes(body.mode)) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: '유효하지 않은 설치 모드입니다. AUTO 또는 MANUAL을 선택하세요.' },
        { status: 400 }
      );
    }

    // 프로젝트 존재 확인
    const project = await dataAdapter.getProjectById(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // AWS 프로젝트 확인
    if (project.cloudProvider !== 'AWS') {
      return NextResponse.json(
        { error: 'INVALID_PROVIDER', message: 'AWS 프로젝트가 아닙니다.' },
        { status: 400 }
      );
    }

    // 이미 설치 모드가 설정된 경우 에러
    if (project.awsInstallationMode) {
      return NextResponse.json(
        { error: 'ALREADY_SET', message: '설치 모드가 이미 설정되어 변경할 수 없습니다.' },
        { status: 409 }
      );
    }

    // 설치 모드 및 hasTfPermission 설정
    const hasTfPermission = body.mode === 'AUTO';

    // 프로젝트 업데이트
    const updatedProject = await dataAdapter.updateProject(projectId, {
      awsInstallationMode: body.mode,
    });

    // AWS 설치 상태도 함께 업데이트 (있는 경우)
    const existingStatus = await dataAdapter.getInstallationStatus(projectId);
    if (existingStatus) {
      await dataAdapter.initializeInstallation(projectId, hasTfPermission);
    } else {
      await dataAdapter.initializeInstallation(projectId, hasTfPermission);
    }

    return NextResponse.json({
      success: true,
      project: updatedProject,
    });
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
};
