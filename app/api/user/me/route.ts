import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';

export async function GET() {
  const user = await dataAdapter.getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      { status: 401 }
    );
  }

  return NextResponse.json({ user });
}
