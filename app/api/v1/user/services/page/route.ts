import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const query = searchParams.get('query') ?? undefined;

  const data = await bff.users.getServicesPage(page, size, query);
  return NextResponse.json(schemas.PageServiceItem.parse(data));
}, { expectedDuration: '50ms ~ 300ms' });
