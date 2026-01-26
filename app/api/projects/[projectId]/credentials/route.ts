import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById, getCredentials } from '@/lib/mock-data';
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

  // 권한 체크: Admin 또는 서비스 담당자
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  // 4단계(WAITING_CONNECTION_TEST), 5단계(CONNECTION_VERIFIED), 6단계(INSTALLATION_COMPLETE)에서 조회 가능
  if (project.processStatus !== ProcessStatus.WAITING_CONNECTION_TEST &&
      project.processStatus !== ProcessStatus.CONNECTION_VERIFIED &&
      project.processStatus !== ProcessStatus.INSTALLATION_COMPLETE) {
    return NextResponse.json(
      { error: 'INVALID_STATE', message: '연결 테스트 단계에서만 Credential을 조회할 수 있습니다.' },
      { status: 400 }
    );
  }

  const credentials = getCredentials();

  return NextResponse.json({ credentials });
}
