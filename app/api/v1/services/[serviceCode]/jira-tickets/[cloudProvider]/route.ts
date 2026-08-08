import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

/**
 * Jira Tickets tag — service↔ticket MAPPING keyed by cloudProvider.
 * Neither verb touches the Jira issue itself (docs/api/jira-tickets.md §1):
 * POST maps an existing issueKey, DELETE unmaps it and reports which key it was.
 */

// POST /services/{serviceCode}/jira-tickets/{cloudProvider} { issueKey, validate } → 204.
export const POST = withV1(async (request, { requestId, params }) => {
  const body: unknown = await request.json().catch(() => null);
  const { issueKey, validate } =
    (body as { issueKey?: unknown; validate?: unknown } | null) ?? {};
  // issueKey 형식은 검증하지 않는다 — 존재 여부 판정은 Jira 를 아는 BFF 몫.
  if (typeof issueKey !== 'string' || issueKey.trim().length === 0) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'issueKey는 비어 있지 않은 문자열이어야 합니다.', requestId),
    );
  }
  await bff.services.jiraTickets.attach(
    String(params.serviceCode),
    String(params.cloudProvider),
    issueKey.trim(),
    // 계약상 optional — boolean 이 아니면 싣지 않고 업스트림 기본값에 맡긴다.
    typeof validate === 'boolean' ? validate : undefined,
  );
  return new NextResponse(null, { status: 204 });
});

// DELETE /services/{serviceCode}/jira-tickets/{cloudProvider} → JiraTicketDetachResponse.
export const DELETE = withV1(async (_request, { params }) => {
  const data = await bff.services.jiraTickets.detach(
    String(params.serviceCode),
    String(params.cloudProvider),
  );
  return NextResponse.json(schemas.JiraTicketDetachResponse.parse(data));
});
