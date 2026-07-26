import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse, createProblem } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §4.
// GET …/collaboration-channel → { issue_key, url } | null (200).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.ops.getCollabChannel(parsed.value);
  return NextResponse.json(data);
});

// PUT …/collaboration-channel { issue_key, url }.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as
    | { issue_key?: unknown; url?: unknown }
    | null;
  const issueKey = typeof body?.issue_key === 'string' ? body.issue_key.trim() : '';
  const url = typeof body?.url === 'string' ? body.url.trim() : '';
  if (!issueKey || !/^https?:\/\//.test(url)) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'issue_key와 http(s) url이 필요합니다.', requestId),
    );
  }

  const data = await bff.ops.putCollabChannel(parsed.value, { issue_key: issueKey, url });
  return NextResponse.json(data);
});
