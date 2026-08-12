import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §3.
// DELETE /admin/access/services/{serviceCode}/users/{userId} — 권한 해제
export const DELETE = withV1(async (_request, { params }) => {
  await bff.access.revokeServiceUser(params.serviceCode, params.userId);
  return new NextResponse(null, { status: 204 });
});
