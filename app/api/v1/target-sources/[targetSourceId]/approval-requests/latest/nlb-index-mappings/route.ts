import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

// GET …/approval-requests/latest/nlb-index-mappings — per-resource current NLB
// assignments (P3 IDC "NLB 정보" modal). OFF-CONTRACT: not in install-v1.yaml
// (user-provided wire, 2026-07-21), so there is no generated schema to parse —
// raw snake passthrough; the CSR adapter owns the camel boundary.
export const GET = withV1(async (_request, { params, requestId }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.taskQueue.getNlbIndexMappings(parsed.value);
  return NextResponse.json(data);
});
