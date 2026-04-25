import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { resolveUserService } from '@/app/api/_lib/user-service';
import { bff } from '@/lib/bff/client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

interface FlatPageMetadata {
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
}

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const query = searchParams.get('query') ?? undefined;

  const data = await bff.users.getServicesPage(page, size, query);

  if (!isRecord(data) || !Array.isArray(data.content)) {
    throw new Error('Invalid services/page response payload');
  }

  // Wire-shape: route reads flat top-level page metadata to preserve
  // the pre-ADR-011 output exactly (I-3). The upstream may instead
  // expose these under `data.page`; reconciling is a follow-up.
  const flat = data as unknown as FlatPageMetadata;

  return NextResponse.json({
    content: data.content.map(resolveUserService),
    page: {
      totalElements: Number(flat.totalElements ?? 0),
      totalPages: Number(flat.totalPages ?? 0),
      number: Number(flat.number ?? 0),
      size: Number(flat.size ?? 10),
    },
  });
}, { expectedDuration: '50ms ~ 300ms' });
