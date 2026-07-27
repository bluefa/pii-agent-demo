import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §6.
// POST /admin/ops/services/{serviceCode}/jira-tickets/{ticketKey}/users { user_id }.
export const POST = withV1(async (request, { requestId, params }) => {
  const body: unknown = await request.json().catch(() => null);
  const userId = (body as { user_id?: unknown } | null)?.user_id;
  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'user_id는 비어 있지 않은 문자열이어야 합니다.', requestId),
    );
  }
  const data = await bff.ops.postJiraUser(
    String(params.serviceCode),
    String(params.ticketKey),
    userId.trim(),
  );
  return NextResponse.json(data);
});
