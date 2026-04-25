import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const data = await bff.services.settings.aws.get(serviceCode);
  return NextResponse.json(data);
}, { expectedDuration: '300ms' });

export const PUT = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  const data = await bff.services.settings.aws.update(serviceCode, body);
  return NextResponse.json(data);
}, { expectedDuration: '500ms' });
