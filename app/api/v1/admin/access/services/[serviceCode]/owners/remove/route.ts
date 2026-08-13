import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// POST /admin/services/{serviceCode}/owners/remove — 해제, body { email }
export const POST = withV1(async (request, { params }) => {
  const body = (await request.json()) as { email?: unknown };
  const email = typeof body.email === 'string' ? body.email : '';
  return NextResponse.json(await bff.access.removeServiceOwner(params.serviceCode, email));
});
