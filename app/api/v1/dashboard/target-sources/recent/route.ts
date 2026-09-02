import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toRequestListPage } from '@/lib/types/task-queue';

// GET /dashboard/target-sources/recent?page=&size=
// 최근 14일 이내 생성된 대상 — 운영 알림의 다섯째 버킷이 SSR 로 읽는 것과 같은
// 업스트림이다. 이 라우트는 연동 요청 큐(CSR)를 위한 hop 1: 다섯 형제 kind 중
// recent 하나만 연다 — 나머지 넷은 아직 브라우저에서 부를 곳이 없다.
//
// 창(14일)은 서버의 것이라 파라미터가 없다. 응답은 형제 목록과 같은
// PageTargetSourceInfo 라, 큐가 이미 쓰는 camel 도메인 매퍼를 그대로 쓴다.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);

  const raw = schemas.PageTargetSourceInfo.parse(
    await bff.taskQueue.getAlertTargetSources({ kind: 'recent', page, size }),
  );
  return NextResponse.json(toRequestListPage(raw));
});
