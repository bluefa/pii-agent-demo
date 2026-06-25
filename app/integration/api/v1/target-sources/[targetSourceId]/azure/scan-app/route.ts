import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { schemas } from '@/lib/generated/install-v1';

// Issue #222 contract: snake_case raw passthrough (bff.azure.getScanApp uses
// getSnakeRaw). Route validates with schemas.AzureServicePrincipalVerificationResponse.
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const raw = await bff.azure.getScanApp(parsed.value);
  return NextResponse.json(schemas.AzureServicePrincipalVerificationResponse.parse(raw));
});
