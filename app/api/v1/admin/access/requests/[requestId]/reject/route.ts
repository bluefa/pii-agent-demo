import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §4.
// POST /admin/access/requests/{requestId}/reject — body { reason } (필수)
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
  const reason = typeof body.reason === 'string' ? body.reason : '';
  return NextResponse.json(await bff.access.rejectRequest(Number(params.requestId), reason));
});
