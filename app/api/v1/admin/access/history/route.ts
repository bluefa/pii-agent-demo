import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// 백엔드 초안 스펙 — docs/api/access-assumed-contracts.md.
// GET /admin/access/history?service_code=&type=&page=&size=
// `service_code` 가 "서비스 코드 단위 이력 조회"의 축이다. 생략하면 전역 로그.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const serviceCode = params.get('service_code') ?? undefined;
  const type = params.get('type') ?? undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 20);
  return NextResponse.json(await bff.access.listHistory({ serviceCode, type }, page, size));
});
