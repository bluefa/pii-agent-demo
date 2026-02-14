import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

export const mockDev = {
  getUsers: async () => {
    const currentUser = await dataAdapter.getCurrentUser();
    const allUsers = await dataAdapter.getUsers();

    return NextResponse.json({
      currentUser: currentUser
        ? { id: currentUser.id, name: currentUser.name, email: currentUser.email, role: currentUser.role }
        : null,
      users: allUsers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
      })),
    });
  },

  switchUser: async (body: unknown) => {
    const { userId } = (body ?? {}) as { userId: string };

    const allUsers = await dataAdapter.getUsers();
    const user = allUsers.find((u) => u.id === userId);

    if (!user) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await dataAdapter.setCurrentUser(userId);

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  },
};
