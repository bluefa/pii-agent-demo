import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import type { AzureSettingsResponse } from '@/app/api/_lib/v1-types';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProject, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

interface LegacyScanApp {
  registered?: boolean;
  appId?: string;
  app_id?: string;
  status?: AzureSettingsResponse['scanApp']['status'];
  lastVerifiedAt?: string;
  last_verified_at?: string;
}

interface LegacyAzureSettings {
  scanApp?: LegacyScanApp;
  scan_app?: LegacyScanApp;
  tenantId?: string;
  tenant_id?: string;
  subscriptionId?: string;
  subscription_id?: string;
}

const mapScanApp = (legacy: LegacyAzureSettings): AzureSettingsResponse['scanApp'] => {
  const scanApp = legacy.scanApp ?? legacy.scan_app;
  const appId = scanApp?.appId ?? scanApp?.app_id ?? '';
  const registered = scanApp?.registered ?? appId.length > 0;
  const lastVerifiedAt = scanApp?.lastVerifiedAt ?? scanApp?.last_verified_at;

  return {
    appId: registered ? appId : '',
    status: registered ? (scanApp?.status ?? 'UNVERIFIED') : 'UNVERIFIED',
    ...(lastVerifiedAt && { lastVerifiedAt }),
  };
};

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
