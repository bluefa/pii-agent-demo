import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// GET /install/v1/target-sources/{targetSourceId}/jira-ticket — the Jira ticket
// mapped to the target source (JiraTicketResponse, camel wire). Upstream 404
// means no ticket is mapped yet; it propagates as-is and the CSR renders the
// 미연결 card state.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = schemas.JiraTicketResponse.parse(
    await bff.targetSources.getJiraTicket(parsed.value),
  );
  return NextResponse.json(raw);
});
