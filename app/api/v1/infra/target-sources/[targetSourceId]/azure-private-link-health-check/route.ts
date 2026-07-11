import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

// G8 — swagger GET /install/v1/infra/target-sources/{targetSourceId}/azure-private-link-health-check
// → AzureHealthCheckResult (wire already camelCase per swagger; parse validates shape).
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const data = await bff.azure.getPrivateLinkHealthCheck(parsed.value);
  return NextResponse.json(schemas.AzureHealthCheckResult.parse(data));
});
