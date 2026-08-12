import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §4.
// GET /admin/access/requests/{requestId} — 요청 상세
export const GET = withV1(async (_request, { params }) => {
  return NextResponse.json(await bff.access.getRequest(Number(params.requestId)));
});
