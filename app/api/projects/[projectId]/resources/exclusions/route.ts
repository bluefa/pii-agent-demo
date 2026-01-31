import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectById } from '@/lib/mock-data';

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

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 과제에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  // 제외된 리소스만 필터링
  const exclusions = project.resources
    .filter(r => r.exclusion)
    .map(r => ({
      resourceId: r.id,
      resourceName: r.resourceId,
      resourceType: r.type,
      reason: r.exclusion!.reason,
      excludedAt: r.exclusion!.excludedAt,
      excludedBy: r.exclusion!.excludedBy,
    }));

  return NextResponse.json({
    exclusions,
    total: exclusions.length,
  });
}
