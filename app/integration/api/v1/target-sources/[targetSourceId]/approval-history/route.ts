import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { normalizeIssue222ApprovalHistoryPage } from '@/lib/issue-222-approval';

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') ?? '0', 10);
  const size = parseInt(url.searchParams.get('size') ?? '10', 10);

  const data = await bff.confirm.getApprovalHistory(parsed.value, page, size);
  return NextResponse.json(
    normalizeIssue222ApprovalHistoryPage(data, parsed.value),
  );
});
