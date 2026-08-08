import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

// POST /services/{serviceCode}/jira-tickets/{cloudProvider}/watchers { userId } → 204.
// Adds a watcher to the mapped Jira ticket (JiraTicketWatcherRequest). The swagger
// declares no business error-code enum for this endpoint — failures surface as the
// generic ErrorMessage, so the client renders the upstream message by HTTP status.
export const POST = withV1(async (request, { requestId, params }) => {
  const body: unknown = await request.json().catch(() => null);
  const userId = (body as { userId?: unknown } | null)?.userId;
  // userId 형식은 검증하지 않는다 — 존재 여부 판정은 Jira 를 아는 BFF 몫.
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'userId는 비어 있지 않은 문자열이어야 합니다.', requestId),
    );
  }
  await bff.services.jiraTickets.addWatcher(
    String(params.serviceCode),
    String(params.cloudProvider),
    userId.trim(),
  );
  return new NextResponse(null, { status: 204 });
});
