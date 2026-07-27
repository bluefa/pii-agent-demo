import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §5.
// GET /admin/ops/target-sources?query&page&size → Page<OpsTargetSourceListItem>.
export const GET = withV1(async (request) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('query') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '0', 10);
  const size = parseInt(url.searchParams.get('size') ?? '20', 10);

  const data = await bff.ops.getTargetSourceList(query, page, size);
  return NextResponse.json(data);
});
