import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

// GET /services/{serviceCode}/jira-tickets → JiraTicketResponse[] (Jira Tickets tag).
export const GET = withV1(async (_request, { params }) => {
  const data = await bff.services.jiraTickets.list(String(params.serviceCode));
  return NextResponse.json(schemas.JiraTicketResponse.array().parse(data));
});
