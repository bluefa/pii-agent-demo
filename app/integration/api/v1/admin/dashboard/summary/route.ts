import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async () => {
  const data = await bff.dashboard.summary();
  return NextResponse.json(data);
}, { expectedDuration: '100ms ~ 500ms' });
