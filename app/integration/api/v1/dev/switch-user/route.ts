import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async () => {
  const data = await bff.dev.getUsers();
  return NextResponse.json(data);
}, { expectedDuration: '50ms' });

export const POST = withV1(async (request) => {
  const body = await request.json().catch(() => ({}));
  const data = await bff.dev.switchUser(body);
  return NextResponse.json(data);
}, { expectedDuration: '100ms' });
