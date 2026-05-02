import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { resolveUserService } from '@/app/api/_lib/user-service';
import { bff } from '@/lib/bff/client';

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const query = searchParams.get('query') ?? undefined;

  const data = await bff.users.getServicesPage(page, size, query);

  return NextResponse.json({
    content: data.content.map(resolveUserService),
    page: {
      totalElements: data.page.total_elements,
      totalPages: data.page.total_pages,
      number: data.page.number ?? 0,
      size: data.page.size,
    },
  });
}, { expectedDuration: '50ms ~ 300ms' });
