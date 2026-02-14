import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProject } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

interface LegacyScanApp {
  registered: boolean;
  appId?: string;
  status?: string;
  lastVerifiedAt?: string;
}

interface LegacyAzureSettings {
  scanApp: LegacyScanApp;
  guide?: unknown;
}

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProject(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.services.settings.azure.get(resolved.project.serviceCode);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyAzureSettings;
  const { scanApp } = legacy;

  return NextResponse.json({
    scanApp: {
      appId: scanApp.registered ? (scanApp.appId ?? '') : '',
      status: scanApp.registered ? (scanApp.status ?? 'UNVERIFIED') : 'UNVERIFIED',
      ...(scanApp.lastVerifiedAt && { lastVerifiedAt: scanApp.lastVerifiedAt }),
    },
  });
});
