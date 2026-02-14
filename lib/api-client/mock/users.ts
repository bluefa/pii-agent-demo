import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

export const mockUsers = {
  search: async (query: string, excludeIds: string[]) => {
    const allUsers = await dataAdapter.getUsers();
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
};
