import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const data = await bff.services.settings.azure.get(serviceCode);
  return NextResponse.json(data);
}, { expectedDuration: '300ms' });
