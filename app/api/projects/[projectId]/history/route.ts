import { NextResponse } from 'next/server';
import { dataAdapter } from '@/lib/adapters';
import type { HistoryFilterType } from '@/lib/mock-history';
import {
  HISTORY_ERROR_CODES,
  VALID_HISTORY_TYPES,
  DEFAULT_HISTORY_LIMIT,
  MAX_HISTORY_LIMIT,
} from '@/lib/constants/history';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  // 1. 인증 확인
  const user = await dataAdapter.getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: HISTORY_ERROR_CODES.UNAUTHORIZED.message },
      { status: HISTORY_ERROR_CODES.UNAUTHORIZED.status }
    );
  }

  const { projectId } = await params;

  // 2. 프로젝트 존재 확인
  const project = await dataAdapter.getProjectById(projectId);
  if (!project) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: HISTORY_ERROR_CODES.NOT_FOUND.message },
      { status: HISTORY_ERROR_CODES.NOT_FOUND.status }
    );
  }

  // 3. 권한 확인
  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: HISTORY_ERROR_CODES.FORBIDDEN.message },
      { status: HISTORY_ERROR_CODES.FORBIDDEN.status }
    );
  }

  // 4. 쿼리 파라미터 파싱
  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type') || 'all';
  const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_HISTORY_LIMIT), 10);
  const offsetParam = parseInt(searchParams.get('offset') || '0', 10);

  // 5. type 파라미터 검증
  if (!VALID_HISTORY_TYPES.includes(typeParam as HistoryFilterType)) {
    return NextResponse.json(
      { error: 'INVALID_TYPE', message: HISTORY_ERROR_CODES.INVALID_TYPE.message },
      { status: HISTORY_ERROR_CODES.INVALID_TYPE.status }
    );
  }

  // 6. limit/offset 정규화
  const limit = Math.min(Math.max(1, limitParam), MAX_HISTORY_LIMIT);
  const offset = Math.max(0, offsetParam);

  // 7. 히스토리 조회
  const { history, total } = await dataAdapter.getProjectHistory({
    projectId,
    type: typeParam as HistoryFilterType,
    limit,
    offset,
  });

  return NextResponse.json({
    history: history.map((h) => ({
      id: h.id,
      type: h.type,
      actor: h.actor,
      timestamp: h.timestamp,
      details: h.details,
    })),
    total,
  });
}
