import { NextResponse } from 'next/server';
import { getCurrentUser, getProjectsByServiceCode } from '@/lib/mock-data';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  const user = getCurrentUser();
  const { serviceCode } = await params;

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '해당 서비스에 대한 권한이 없습니다.' },
      { status: 403 }
    );
  }

  const projects = getProjectsByServiceCode(serviceCode).map((p) => ({
    id: p.id,
    projectCode: p.projectCode,
    processStatus: p.processStatus,
    cloudProvider: p.cloudProvider,
    resourceCount: p.resources.length,
    hasDisconnected: p.resources.some((r) => r.connectionStatus === 'DISCONNECTED'),
    hasNew: p.resources.some((r) => r.connectionStatus === 'NEW'),
  }));

  return NextResponse.json({ projects });
}
