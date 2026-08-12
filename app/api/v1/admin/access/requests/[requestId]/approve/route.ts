import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §4. 승인이 곧 부여다.
// POST /admin/access/requests/{requestId}/approve — body { message } (선택)
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json().catch(() => ({}))) as { message?: unknown };
  const message = typeof body.message === 'string' ? body.message : '';
  return NextResponse.json(await bff.access.approveRequest(Number(params.requestId), message));
});
