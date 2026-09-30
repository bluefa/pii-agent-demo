import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §4 (BE PR #8891, ahead of the
// swagger drop). Snake wire both ways, passed through verbatim: the reader in
// lib/types/collaboration-channel.ts owns the casing boundary on both surfaces.

// GET …/collaboration-channel → always 200 (NONE when no ticket was ever created).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);
  return NextResponse.json(await bff.ops.getCollaborationChannel(parsed.value));
});

// PUT …/collaboration-channel { issue_key, url? } → the linked channel (status CREATED).
// The two upstream 409s (JIRA_TICKET_CREATION_IN_PROGRESS / plain conflict) propagate as
// BffError → ProblemDetails, code intact, so the modal can tell them apart.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as
    | { issue_key?: unknown; url?: unknown }
    | null;
  const issueKey = typeof body?.issue_key === 'string' ? body.issue_key.trim() : '';
  if (!issueKey) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'issue_key는 비어 있을 수 없습니다.', requestId),
    );
  }
  const url = typeof body?.url === 'string' && body.url.trim() ? body.url.trim() : undefined;

  return NextResponse.json(
    await bff.ops.putCollaborationChannel(parsed.value, url ? { issue_key: issueKey, url } : { issue_key: issueKey }),
  );
});
