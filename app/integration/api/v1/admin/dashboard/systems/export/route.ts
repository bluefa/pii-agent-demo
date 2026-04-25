import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const upstream = await bff.dashboard.systemsExport(searchParams);
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}, { expectedDuration: '500ms ~ 2s' });
