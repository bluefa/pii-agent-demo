import { NextRequest, NextResponse } from 'next/server';
import { mockUsers } from '@/lib/mock-data';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.toLowerCase() || '';
  const excludeIds = searchParams.get('exclude')?.split(',').filter(Boolean) || [];

  let users = mockUsers.filter((u) => u.role !== 'ADMIN');

  if (excludeIds.length > 0) {
    users = users.filter((u) => !excludeIds.includes(u.id));
  }

  if (query) {
    users = users.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query) ||
        u.id.toLowerCase().includes(query)
    );
  }

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    })),
  });
}
