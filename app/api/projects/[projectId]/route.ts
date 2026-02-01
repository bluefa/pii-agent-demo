import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, deleteProject } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const project = getProjectById(projectId);

  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  // core.md 스펙에 맞게 필드 선별 반환
  const isIntegrated = project.processStatus === ProcessStatus.INSTALLATION_COMPLETE;

  return NextResponse.json({
    id: project.id,
    projectCode: project.projectCode,
    name: project.name,
    description: project.description,
    serviceCode: project.serviceCode,
    cloudProvider: project.cloudProvider,
    isIntegrated,
    tfPermissionGranted: project.cloudProvider === 'AWS' ? true : undefined, // TODO: 실제 값으로 대체
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 과제를 삭제할 수 있습니다.' },
      { status: 403 }
    );
  }

  const success = deleteProject(projectId);

  if (!success) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
