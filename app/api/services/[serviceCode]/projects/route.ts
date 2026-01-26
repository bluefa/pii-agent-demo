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

  const projects = getProjectsByServiceCode(serviceCode).map((p) => {
    // 선택된 리소스 (DISCOVERED가 아닌 리소스)
    const selectedResources = p.resources.filter(
      (r) => r.isSelected || r.lifecycleStatus !== 'DISCOVERED'
    );
    // 연결 테스트 완료: 선택된 리소스가 있고, 모두 CONNECTED 상태
    const connectionTestComplete =
      selectedResources.length > 0 &&
      selectedResources.every((r) => r.connectionStatus === 'CONNECTED');

    return {
      id: p.id,
      projectCode: p.projectCode,
      processStatus: p.processStatus,
      cloudProvider: p.cloudProvider,
      resourceCount: p.resources.length,
      hasDisconnected: p.resources.some((r) => r.connectionStatus === 'DISCONNECTED'),
      hasNew: p.resources.some((r) => r.isNew === true),
      description: p.description,
      isRejected: p.isRejected,
      rejectionReason: p.rejectionReason,
      connectionTestComplete,
    };
  });

  return NextResponse.json({ projects });
}
