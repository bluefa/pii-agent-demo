import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus } from '@/lib/types';

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

  // 1단계 또는 5단계(재설치)에서만 가능
  if (
    project.processStatus !== ProcessStatus.WAITING_TARGET_CONFIRMATION &&
    project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE
  ) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '현재 상태에서는 연동 대상을 확정할 수 없습니다.' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { resourceIds } = body as { resourceIds: string[] };
  const selectedSet = new Set(resourceIds);

  const updatedResources = project.resources.map((r) => {
    const isSelected = selectedSet.has(r.id);

    const lifecycleStatus: ResourceLifecycleStatus = isSelected
      ? 'PENDING_APPROVAL'
      : 'DISCOVERED';

    return {
      ...r,
      isSelected,
      lifecycleStatus: lifecycleStatus,
    };
  });

  const updatedProject = updateProject(projectId, {
    resources: updatedResources,
    processStatus: ProcessStatus.WAITING_APPROVAL,
  });

  return NextResponse.json({ success: true, project: updatedProject });
}
