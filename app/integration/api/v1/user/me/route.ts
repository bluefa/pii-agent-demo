import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

export const GET = withV1(async () => {
  const data = await bff.users.me();
  return NextResponse.json(schemas.UserMeResponse.parse(data));
}, { expectedDuration: '50ms ~ 200ms' });
