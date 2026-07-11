import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const data = await bff.services.permissions.list(serviceCode);
  return NextResponse.json(schemas.AuthorizedUsersResponse.parse(data));
}, { expectedDuration: '80ms ~ 300ms' });
