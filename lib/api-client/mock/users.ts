import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';

export const mockUsers = {
  search: async (query: string, excludeIds: string[]) => {
    const allUsers = mockData.mockUsers;
    let users = allUsers.filter((u) => u.role !== 'ADMIN');

    if (excludeIds.length > 0) {
      users = users.filter((u) => !excludeIds.includes(u.id));
    }

    if (query) {
      const q = query.toLowerCase();
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q)
      );
    }

    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
      })),
    });
  },

  getMe: async () => {
    const user = await mockData.getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  },

  getServices: async () => {
    const user = await mockData.getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const allServiceCodes = mockData.mockServiceCodes;
    const services =
      user.role === 'ADMIN'
        ? allServiceCodes
        : allServiceCodes.filter((s) => user.serviceCodePermissions.includes(s.code));

    return NextResponse.json({ services });
  },
};
