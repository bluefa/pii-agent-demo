import { NextResponse } from 'next/server';
import { setCurrentUser, mockUsers, getCurrentUser } from '@/lib/mock-data';

export async function GET() {
  const currentUser = getCurrentUser();

  return NextResponse.json({
    currentUser: currentUser
      ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role }
      : null,
    users: mockUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { userId } = body as { userId: string };

  const user = mockUsers.find((u) => u.id === userId);

  if (!user) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  setCurrentUser(userId);

  return NextResponse.json({
    success: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
