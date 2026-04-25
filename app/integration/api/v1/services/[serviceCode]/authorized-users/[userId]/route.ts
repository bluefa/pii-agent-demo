import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const DELETE = withV1(async (_request, { params }) => {
  const { serviceCode, userId } = params;
  const data = await bff.services.permissions.remove(serviceCode, userId);
  return NextResponse.json(data);
}, { expectedDuration: '100ms ~ 400ms' });
