import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// GET …/idc/previous-request — ADR-019 zod-codegen. Route validates raw BFF
// response against the swagger schema; no casing transform.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.idc.getPreviousRequest(parsed.value);
  return NextResponse.json(schemas.IdcPreviousRequestResponse.parse(data));
});
