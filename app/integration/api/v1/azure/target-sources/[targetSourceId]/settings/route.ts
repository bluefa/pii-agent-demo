import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import { mapScanApp } from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/settings-transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const legacy = await bff.azure.getSettings(parsed.value);
  const resolvedProject = resolveProject(parsed.value, requestId);
  const tenantId = legacy.tenantId
    ?? legacy.tenant_id
    ?? (resolvedProject.ok ? resolvedProject.project.tenantId : undefined);
  const subscriptionId = legacy.subscriptionId
    ?? legacy.subscription_id
    ?? (resolvedProject.ok ? resolvedProject.project.subscriptionId : undefined);

  return NextResponse.json({
    ...(tenantId && { tenantId }),
    ...(subscriptionId && { subscriptionId }),
    scanApp: mapScanApp(legacy),
  });
}, { expectedDuration: '50ms ~ 200ms' });
