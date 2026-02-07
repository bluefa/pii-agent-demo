import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ProcessStatus, ResourceLifecycleStatus, ProjectStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = await dataAdapter.getCurrentUser();
  const { projectId } = await params;

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const project = await dataAdapter.getProjectById(projectId);

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

  const now = new Date().toISOString();

  // status 필드 업데이트 (ADR-004)
  const updatedStatus: ProjectStatus = {
    ...project.status,
    installation: {
      status: 'COMPLETED',
      completedAt: now,
    },
  };

  // 계산된 processStatus
  const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

  const updatedProject = await dataAdapter.updateProject(projectId, {
    processStatus: calculatedProcessStatus,
    status: updatedStatus,
    resources: updatedResources,
    terraformState,
  });

  return NextResponse.json({ success: true, project: updatedProject });
}
