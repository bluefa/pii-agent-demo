import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §3.
// POST …/sdu/definition/submit → 204. SDU has no approval step: submitting the definition
// is what moves the target from 연동 대상 정의 to 데이터 업로드.
//
// Nothing is read off the response, so success is judged by status alone — the screen
// re-reads process-status to learn which step it is now on.
export const POST = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  await bff.sdu.submitDefinition(parsed.value);
  return new NextResponse(null, { status: 204 });
});
