import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/access-assumed-contracts.md §3.
// POST /admin/access/services/{serviceCode}/users/remove — 담당자 해제, body { email }
//
// POST + body rather than DELETE …/{email}: the identity key is an email address,
// and an email in a URL path lands in every access log, proxy trace and referrer.
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json()) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email : '';
  await bff.access.revokeServiceUser(params.serviceCode, email);
  return new NextResponse(null, { status: 204 });
});
