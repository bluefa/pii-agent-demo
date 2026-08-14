import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// GET /admin/access/permission-access/{requestId} — 사유와 판정이 사는 곳
export const GET = withV1(async (_request, { params }) => {
  return NextResponse.json(await bff.access.getRequest(Number(params.requestId)));
});
