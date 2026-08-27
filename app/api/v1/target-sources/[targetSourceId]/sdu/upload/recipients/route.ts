import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §7.
// PUT …/sdu/upload/recipients { user_ids: string[] } → 204.
//
// A LIST, not a send: the S3 Access Key is delivered by an administrator over mail, and
// this only records who it goes to. Nothing here triggers a notification.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as { user_ids?: unknown } | null;
  const userIds = body?.user_ids;
  if (!Array.isArray(userIds) || !userIds.every((id) => typeof id === 'string')) {
    return problemResponse(
      createProblem('VALIDATION_FAILED', 'user_ids는 문자열 배열이어야 합니다.', requestId),
    );
  }

  await bff.sdu.putRecipients(parsed.value, userIds);
  return new NextResponse(null, { status: 204 });
});
