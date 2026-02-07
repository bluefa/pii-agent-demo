import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string; userId: string }> }
) {
  const user = await dataAdapter.getCurrentUser();
  const { serviceCode, userId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 권한을 제거할 수 있습니다.' },
      { status: 403 }
    );
  }

  const allUsers = await dataAdapter.getUsers();
  const targetUser = allUsers.find((u) => u.id === userId);

  if (!targetUser) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const index = targetUser.serviceCodePermissions.indexOf(serviceCode);

  if (index === -1) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '해당 사용자는 이 서비스에 대한 권한이 없습니다.' },
      { status: 404 }
    );
  }

  targetUser.serviceCodePermissions.splice(index, 1);

  return NextResponse.json({ success: true });
}
