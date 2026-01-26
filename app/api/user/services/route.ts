import { NextResponse } from 'next/server';
import { getCurrentUser, mockServiceCodes } from '@/lib/mock-data';

export async function GET() {
  const user = getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  const services =
    user.role === 'ADMIN'
      ? mockServiceCodes
      : mockServiceCodes.filter((s) => user.serviceCodePermissions.includes(s.code));

  return NextResponse.json({ services });
}
