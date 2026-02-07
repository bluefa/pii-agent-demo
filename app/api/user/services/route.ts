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

  const allServiceCodes = await dataAdapter.getServiceCodes();
  const services =
    user.role === 'ADMIN'
      ? allServiceCodes
      : allServiceCodes.filter((s) => user.serviceCodePermissions.includes(s.code));

  return NextResponse.json({ services });
}
