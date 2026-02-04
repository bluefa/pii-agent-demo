import { NextResponse } from 'next/server';
import { getCurrentUser, removeUserPermission } from '@/lib/mock-data';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string; userId: string }> }
) {
  const user = getCurrentUser();
  const { serviceCode, userId } = await params;

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 권한을 제거할 수 있습니다.' },
      { status: 403 }
    );
  }

  const result = removeUserPermission(userId, serviceCode);

  if (!result.success) {
    if (result.error === 'USER_NOT_FOUND') {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }
    if (result.error === 'NOT_FOUND') {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '해당 사용자는 이 서비스에 대한 권한이 없습니다.' },
        { status: 404 }
      );
    }
  }

  return NextResponse.json({ success: true });
}
