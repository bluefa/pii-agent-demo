import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §6.
// POST /admin/access/admins/remove — 관리자 권한 회수, body { email }. 자기 자신은 400.
// Email keys stay out of the URL (see the service-user remove route).
export const POST = withV1(async (request) => {
  const body = (await request.json()) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email : '';
  await bff.access.revokeAdmin(email);
  return new NextResponse(null, { status: 204 });
});
