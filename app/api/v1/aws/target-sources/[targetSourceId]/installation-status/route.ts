import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';
import type { AwsInstallationStatus, ServiceTfScript } from '@/lib/types';

interface V1ServiceScript {
  scriptName: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  region?: string;
  resources: { resourceId: string; type: string; name: string }[];
}

interface V1LastCheck {
  status: 'SUCCESS' | 'IN_PROGRESS' | 'FAILED';
  checkedAt?: string;
  failReason?: string;
}

interface V1AwsInstallationStatus {
  hasExecutionPermission: boolean;
  serviceScripts: V1ServiceScript[];
  bdcStatus: { status: 'PENDING' | 'COMPLETED' | 'FAILED' };
  lastCheck: V1LastCheck;
}

const toScriptStatus = (status: string): 'PENDING' | 'COMPLETED' | 'FAILED' =>
  status === 'IN_PROGRESS' ? 'PENDING' : (status as 'PENDING' | 'COMPLETED' | 'FAILED');

const transformServiceScript = (script: ServiceTfScript): V1ServiceScript => ({
  scriptName: script.label,
  status: toScriptStatus(script.status),
  ...(script.region && { region: script.region }),
  resources: script.resources.map(r => ({ resourceId: r.resourceId, type: r.type, name: r.name })),
});

const transformInstallationStatus = (legacy: AwsInstallationStatus): V1AwsInstallationStatus => ({
  hasExecutionPermission: legacy.hasTfPermission,
  serviceScripts: legacy.serviceTfScripts.map(transformServiceScript),
  bdcStatus: { status: toScriptStatus(legacy.bdcTf.status) },
  lastCheck: legacy.lastCheckedAt
    ? { status: 'SUCCESS', checkedAt: legacy.lastCheckedAt }
    : { status: 'SUCCESS' },
});

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.aws.getInstallationStatus(resolved.projectId);
  if (!response.ok) return response;

  const legacy = await response.json() as AwsInstallationStatus;
  return NextResponse.json(transformInstallationStatus(legacy));
}, { expectedDuration: '5000ms' });
