import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProject, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  mapScanApp,
  type LegacyAzureSettings,
} from '@/app/integration/api/v1/azure/target-sources/[targetSourceId]/_lib/settings-transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.azure.getSettings(resolved.projectId);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyAzureSettings;
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
