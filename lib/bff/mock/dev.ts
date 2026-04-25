import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';

export const mockDev = {
  getUsers: async () => {
    const currentUser = await mockData.getCurrentUser();
    const allUsers = mockData.mockUsers;

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

    const allUsers = mockData.mockUsers;
    const user = allUsers.find((u) => u.id === userId);

    if (!user) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    await mockData.setCurrentUser(userId);

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  },
};
