import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, updateProject } from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';

export async function PATCH(
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
      { error: 'INVALID_STATE', message: '연결 테스트 단계에서만 Credential을 변경할 수 있습니다.' },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { resourceId, credentialId } = body;

  if (!resourceId) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'resourceId가 필요합니다.' },
      { status: 400 }
    );
  }

  const updatedResources = project.resources.map((r) => {
    if (r.id !== resourceId) return r;
    return {
      ...r,
      selectedCredentialId: credentialId || undefined,
    };
  });

  const updatedProject = updateProject(projectId, {
    resources: updatedResources,
  });

  return NextResponse.json({
    success: true,
    project: updatedProject,
  });
}
