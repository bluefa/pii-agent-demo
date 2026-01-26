import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/mock-data';

export async function GET() {
  const user = getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  return NextResponse.json({ user });
}
