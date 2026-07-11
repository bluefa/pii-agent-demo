import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';
import { z } from 'zod';

// GET /idc/nlb/{nlbIndex}/resources — ADR-019 zod-codegen. Array of
// NlbOccupiedResourceResponse (camelCase ON THE WIRE per swagger). Route validates;
// no casing transform.
export const GET = withV1(async (_request, { requestId, params }) => {
  const nlbIndex = Number(params.nlbIndex);
  if (!Number.isInteger(nlbIndex) || nlbIndex < 0) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', `nlbIndex는 0 이상의 정수여야 합니다: "${params.nlbIndex}"`, requestId),
    );
  }
  const data = await bff.idc.getOccupiedResources(nlbIndex);
  return NextResponse.json(z.array(schemas.NlbOccupiedResourceResponse).parse(data));
});
