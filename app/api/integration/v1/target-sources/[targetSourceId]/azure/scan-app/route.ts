import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import {
  mapIssue222AzureScanApp,
  type LegacyAzureSettings,
} from '@/app/api/integration/v1/azure/target-sources/[targetSourceId]/_lib/settings-transform';

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.azure.getSettings(resolved.projectId);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyAzureSettings;
  return NextResponse.json(mapIssue222AzureScanApp(legacy));
});
