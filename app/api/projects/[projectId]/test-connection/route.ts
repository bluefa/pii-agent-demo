import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus, ConnectionStatus } from '@/lib/types';

export async function POST(
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

  if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '연결 테스트가 필요한 상태가 아닙니다.' },
      { status: 400 }
    );
  }

  // Mock: 모든 연결 성공
  const results = project.resources
    .filter((r) => r.isSelected)
    .map((r) => ({
      resourceId: r.resourceId,
      success: true,
      message: '연결 성공',
    }));
  const updatedResources = project.resources.map((r) => {
    if (!r.isSelected) return r;

    const lifecycleStatus: ResourceLifecycleStatus = 'ACTIVE';
    const connectionStatus: ConnectionStatus = 'CONNECTED';

    return {
      ...r,
      connectionStatus: connectionStatus,
      lifecycleStatus,
      isNew: false,
      note: r.note === 'NEW' ? undefined : r.note,
    };
  });

  const updatedProject = updateProject(projectId, {
    resources: updatedResources,
    processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  });

  return NextResponse.json({
    success: true,
    project: updatedProject,
    results,
  });
}
