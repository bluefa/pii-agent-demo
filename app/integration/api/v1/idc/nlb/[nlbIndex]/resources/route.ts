import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { createProblem, problemResponse } from '@/app/api/_lib/problem';

// GET /idc/nlb/{nlbIndex}/resources — array of NlbOccupiedResourceResponse
// (camelCase ON THE WIRE per swagger). Raw passthrough; the IDC mapper
// (app/lib/api/idc.ts) owns the wire→domain conversion (ADR-019 D6 carve-out).
export const GET = withV1(async (_request, { requestId, params }) => {
  const nlbIndex = Number(params.nlbIndex);
  if (!Number.isInteger(nlbIndex) || nlbIndex < 0) {
    return problemResponse(
      createProblem('INVALID_PARAMETER', `nlbIndex는 0 이상의 정수여야 합니다: "${params.nlbIndex}"`, requestId),
    );
  }
  return NextResponse.json(await bff.idc.getOccupiedResources(nlbIndex));
});
