import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { ALERT_TARGET_KINDS, isAlertTargetKind, toRequestListPage } from '@/lib/types/task-queue';

// GET /admin/queue/alert-target-sources?kind=&page=&size=
// 운영 알림 drill-down. Fans out to the four upstream siblings
// (/dashboard/target-sources/{confirming,need-install,need-test-connection,
// need-pii-agent-confirm}); all four return PageTargetSourceInfo, so the P2
// request-list reshape is reused verbatim.
export const GET = withV1(async (request, { requestId }) => {
  const params = new URL(request.url).searchParams;
  const kind = params.get('kind') ?? '';
  if (!isAlertTargetKind(kind)) {
    return problemResponse(
      createProblem(
        'INVALID_PARAMETER',
        `kind는 ${ALERT_TARGET_KINDS.join(' | ')} 중 하나여야 합니다.`,
        requestId,
      ),
    );
  }
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);

  const raw = schemas.PageTargetSourceInfo.parse(
    await bff.taskQueue.getAlertTargetSources({ kind, page, size }),
  );
  return NextResponse.json(toRequestListPage(raw));
});
