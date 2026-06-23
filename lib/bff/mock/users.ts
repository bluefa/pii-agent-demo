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

    // Wire: UserSearchResponse { users: UserInfo[] } — case-neutral keys.
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

    // Wire: UserMeResponse is FLAT { id, name, email } (50) — no `{ user }` wrapper.
    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  },

  getServicesPage: async (page: number, size: number, query?: string) => {
    const user = await mockData.getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    const allServiceCodes = mockData.mockServiceCodes;
    const permitted =
      user.role === 'ADMIN'
        ? allServiceCodes
        : allServiceCodes.filter((s) => user.serviceCodePermissions.includes(s.code));

    const filtered = query
      ? permitted.filter((s) => {
          const q = query.toLowerCase();
          return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
        })
      : permitted;

    const totalElements = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / size));
    const start = page * size;
    const content = filtered.slice(start, start + size);

    // Wire: PageServiceItem (49) — Spring Page envelope. Envelope keys are
    // camelCase on the wire; only `content[].service_code/service_name` is snake.
    return NextResponse.json({
      content: content.map((s) => ({
        service_code: s.code,
        service_name: s.name,
      })),
      totalElements,
      totalPages,
      number: page,
      size,
      first: page === 0,
      last: page >= totalPages - 1,
      numberOfElements: content.length,
      empty: content.length === 0,
      pageable: {
        paged: true,
        pageNumber: page,
        pageSize: size,
        unpaged: false,
        offset: page * size,
        sort: [],
      },
      sort: [],
    });
  },
};
