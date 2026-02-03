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

  if (project.processStatus !== ProcessStatus.INSTALLING) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '설치중 상태가 아닙니다.' },
      { status: 400 }
    );
  }

  // INSTALLING 상태인 리소스를 READY_TO_TEST로 변경
  const updatedResources = project.resources.map((r) => {
    if (r.lifecycleStatus !== 'INSTALLING') return r;

    return {
      ...r,
      lifecycleStatus: 'READY_TO_TEST' as ResourceLifecycleStatus,
    };
  });

  // Terraform 상태 완료 처리
  const terraformState = {
    ...project.terraformState,
    serviceTf: project.cloudProvider === 'AWS' ? 'COMPLETED' as const : undefined,
    bdcTf: 'COMPLETED' as const,
  };

  const updatedProject = updateProject(projectId, {
    processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    resources: updatedResources,
    terraformState,
  });

  return NextResponse.json({ success: true, project: updatedProject });
}
