import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// GET /admin/access/services?page=&size=&q= — 관리자 서비스 목록 (권한자 수 포함)
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const q = params.get('q') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listServices(q, page, size));
});
