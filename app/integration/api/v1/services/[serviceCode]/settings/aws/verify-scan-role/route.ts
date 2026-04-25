import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const POST = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const data = await bff.services.settings.aws.verifyScanRole(serviceCode);
  return NextResponse.json(data);
}, { expectedDuration: '5000ms' });
