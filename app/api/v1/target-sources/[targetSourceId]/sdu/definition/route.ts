import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import type { SduDefinitionRequestWire } from '@/lib/types/sdu';

// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §1·§2.
// GET  …/sdu/definition → SduDefinition
// PUT  …/sdu/definition { region_scope, targets[] } → SduDefinition
//
// The body is passed through verbatim: every rule that can reject it (scope lock, region
// membership, the 20/50 caps, IPv4) needs the STORED definition to decide, so it lives
// server-side. A second copy here would be a rule the upstream never agreed to.

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  return NextResponse.json(await bff.sdu.getDefinition(parsed.value));
});

export const PUT = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const body = (await request.json().catch(() => null)) as SduDefinitionRequestWire | null;
  if (body === null || typeof body !== 'object') {
    return problemResponse(
      createProblem('VALIDATION_FAILED', '요청 본문은 JSON object여야 합니다.', requestId),
    );
  }

  return NextResponse.json(await bff.sdu.putDefinition(parsed.value, body));
});
