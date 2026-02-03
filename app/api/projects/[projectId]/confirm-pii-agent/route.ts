import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus, ResourceLifecycleStatus, ProjectStatus } from '@/lib/types';
import { getCurrentStep } from '@/lib/process';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const user = getCurrentUser();
  const { projectId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 설치 확정할 수 있습니다.' },
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

  if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '연결 테스트 대기 상태가 아닙니다.' },
      { status: 400 }
    );
  }

  // READY_TO_TEST 상태인 리소스를 ACTIVE로 변경, connectionStatus도 CONNECTED로
  const updatedResources = project.resources.map((r) => {
    if (r.lifecycleStatus !== 'READY_TO_TEST') return r;

    return {
      ...r,
      lifecycleStatus: 'ACTIVE' as ResourceLifecycleStatus,
      connectionStatus: 'CONNECTED' as const,
    };
  });

  const now = new Date().toISOString();

  // status 필드 업데이트 (ADR-004)
  const updatedStatus: ProjectStatus = {
    ...project.status,
    connectionTest: {
      status: 'PASSED',
      lastTestedAt: now,
      passedAt: now,
    },
  };

  // 계산된 processStatus
  const calculatedProcessStatus = getCurrentStep(project.cloudProvider, updatedStatus);

  const updatedProject = updateProject(projectId, {
    processStatus: calculatedProcessStatus,
    status: updatedStatus,
    resources: updatedResources,
    piiAgentInstalled: true,
  });

  return NextResponse.json({ success: true, project: updatedProject });
}
