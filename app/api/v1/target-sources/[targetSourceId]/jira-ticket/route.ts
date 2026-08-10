import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { schemas } from '@/lib/generated/install-v1';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// REAL contract — GET /install/v1/target-sources/{id}/jira-ticket (JiraTicketResponse,
// camel wire). Read-only by contract: the writes live on the service × provider axis
// (/services/{code}/jira-tickets/{provider}), which the 서비스 운영 화면 owns.
//
// 404 = no ticket mapped to this target. That is an answer, not an outage, so it is
// normalized to a 200 null — the same reading the 서비스측 page already applies
// (app/target-sources/[targetSourceId]/page.tsx), so both screens agree.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  let raw: unknown;
  try {
    raw = await bff.targetSources.getJiraTicket(parsed.value);
  } catch (err) {
    if (err instanceof BffError && err.status === 404) return NextResponse.json(null);
    throw err;
  }
  const ticket = schemas.JiraTicketResponse.parse(raw);
  // loose schema — an issueKey-less body is the same fact as a 404.
  return NextResponse.json(ticket.issueKey ? ticket : null);
});
