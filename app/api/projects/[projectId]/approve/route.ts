import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 승인할 수 있습니다.' },
      { status: 403 }
    );
  }

  const project = getProjectById(projectId);

  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '과제를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (project.processStatus !== ProcessStatus.WAITING_APPROVAL) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '승인 대기 상태가 아닙니다.' },
      { status: 400 }
    );
  }

  const updatedResources = project.resources.map((r) => {
    if (!r.isSelected) return r;

    const lifecycleStatus: ResourceLifecycleStatus = 'INSTALLING';

    return {
      ...r,
      lifecycleStatus,
    };
  });

  const terraformState = project.cloudProvider === 'AWS'
    ? { serviceTf: 'PENDING' as const, bdcTf: 'PENDING' as const }
    : { bdcTf: 'PENDING' as const };

  const updatedProject = updateProject(projectId, {
    processStatus: ProcessStatus.INSTALLING,
    resources: updatedResources,
    terraformState,
    isRejected: false,
  });

  return NextResponse.json({ success: true, project: updatedProject });
}
