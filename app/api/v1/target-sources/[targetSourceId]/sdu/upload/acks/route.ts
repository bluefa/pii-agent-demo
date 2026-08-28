import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import type { SduAcksRequestWire } from '@/lib/types/sdu';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §6.
// PUT …/sdu/upload/acks { kind, confirmed } → 204.
//
// `confirmed: false` is a first-class value, not a missing answer: the gates only block
// forward, so every finished block keeps a way back. One answer per block — the screen
// asks one question covering every Region, so there is no finer answer to record.
export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as SduAcksRequestWire | null;
  if (body === null || typeof body !== 'object') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', '요청 본문은 JSON object여야 합니다.', requestId),
    );
  }

  await bff.sdu.putAcks(parsed.value, body);
  return new NextResponse(null, { status: 204 });
});
