import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

export async function GET(
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

  // 권한 체크: Admin 또는 서비스 담당자
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const credentials = await dataAdapter.getCredentials();

  return NextResponse.json({ credentials });
}
