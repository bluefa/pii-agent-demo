import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §6.
// DELETE /admin/access/admins/{userId} — 관리자 권한 회수 (자기 자신은 400)
export const DELETE = withV1(async (_request, { params }) => {
  await bff.access.revokeAdmin(params.userId);
  return new NextResponse(null, { status: 204 });
});
