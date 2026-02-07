import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import { ProcessStatus } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  const user = await dataAdapter.getCurrentUser();
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

  // core.md 스펙에 맞게 필드 선별 반환
  const projects = (await dataAdapter.getProjectsByServiceCode(serviceCode)).map((p) => {
    const isIntegrated = p.processStatus === ProcessStatus.INSTALLATION_COMPLETE;

    return {
      id: p.id,
      projectCode: p.projectCode,
      name: p.name,
      cloudProvider: p.cloudProvider,
      isIntegrated,
      createdAt: p.createdAt,
    };
  });

  return NextResponse.json({ projects });
}
