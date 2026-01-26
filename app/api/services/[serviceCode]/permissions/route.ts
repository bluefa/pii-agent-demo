import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/mock-data';
import { getStore } from '@/lib/mock-store';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  const user = getCurrentUser();
  const { serviceCode } = await params;
  const store = getStore();

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 권한을 조회할 수 있습니다.' },
      { status: 403 }
    );
  }

  const usersWithPermission = store.users
    .filter((u) => u.serviceCodePermissions.includes(serviceCode))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    }));

  return NextResponse.json({ users: usersWithPermission });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ serviceCode: string }> }
) {
  const user = getCurrentUser();
  const { serviceCode } = await params;
  const store = getStore();

  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: '관리자만 권한을 추가할 수 있습니다.' },
      { status: 403 }
    );
  }

  if (!store.serviceCodes.find((s) => s.code === serviceCode)) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '존재하지 않는 서비스 코드입니다.' },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { userId } = body as { userId: string };

  const targetUser = store.users.find((u) => u.id === userId);

  if (!targetUser) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '해당 사용자를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  if (targetUser.serviceCodePermissions.includes(serviceCode)) {
    return NextResponse.json(
      { error: 'ALREADY_EXISTS', message: '이미 해당 서비스에 대한 권한이 있습니다.' },
      { status: 400 }
    );
  }

  targetUser.serviceCodePermissions.push(serviceCode);

  return NextResponse.json({
    success: true,
    user: { id: targetUser.id, name: targetUser.name, email: targetUser.email },
  });
}
