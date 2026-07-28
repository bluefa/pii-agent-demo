import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// Terraform state read straight from the BFF DB (no Cloud SDK call), so it can
// disagree with installation-status — the two are shown as separate facts.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = schemas.TerraformStatusResponse.parse(
    await bff.confirm.getTerraformStatus(parsed.value),
  );

  return NextResponse.json(raw);
});
