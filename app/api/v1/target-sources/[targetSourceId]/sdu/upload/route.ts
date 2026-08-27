import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §4.
// GET …/sdu/upload → the whole 데이터 업로드 step in one response. Every list in it is
// keyed by Region, which is what lets a return trip to Step 1 invalidate per region
// instead of wiping the step.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  return NextResponse.json(await bff.sdu.getUpload(parsed.value));
});
