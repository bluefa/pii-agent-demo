import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';

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

  // 관리자만 가능
  if (user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 설치 완료를 확정할 수 있습니다.' },
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

  // 5단계(CONNECTION_VERIFIED)에서만 확정 가능
  if (project.processStatus !== ProcessStatus.CONNECTION_VERIFIED) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '연결 확인이 완료된 상태에서만 설치 완료를 확정할 수 있습니다.' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const updatedProject = updateProject(projectId, {
    processStatus: ProcessStatus.INSTALLATION_COMPLETE,
    completionConfirmedAt: now,
    // 최초 1회 연동 완료 표시
    piiAgentInstalled: true,
    piiAgentConnectedAt: project.piiAgentConnectedAt || now,
  });

  return NextResponse.json({ project: updatedProject });
}
