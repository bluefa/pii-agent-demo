import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  const data = await bff.targetSources.previewRegistration(serviceCode, body);
  return NextResponse.json(data);
}, { expectedDuration: '100ms ~ 400ms' });
