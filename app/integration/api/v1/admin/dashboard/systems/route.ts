import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const data = await bff.dashboard.systems(searchParams);
  return NextResponse.json(data);
}, { expectedDuration: '100ms ~ 500ms' });
