import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';

interface LegacyStepStatus {
  status: 'COMPLETED' | 'FAIL' | 'IN_PROGRESS' | 'SKIP';
  guide?: string | null;
}

interface LegacyGcpResource {
  resourceId: string;
  resourceName?: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  resourceSubType?: 'PRIVATE_IP_MODE' | 'BDC_PRIVATE_HOST_MODE' | 'PSC_MODE' | null;
  installationStatus: 'COMPLETED' | 'FAIL' | 'IN_PROGRESS';
  serviceSideSubnetCreation: LegacyStepStatus;
  serviceSideTerraformApply: LegacyStepStatus;
  bdcSideTerraformApply: LegacyStepStatus;
}

interface LegacyGcpInstallationStatus {
  provider: 'GCP';
  resources: LegacyGcpResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

const buildLastCheck = (lastCheckedAt?: string, error?: { code: string; message: string }) => {
  if (!lastCheckedAt && !error) {
    return { status: 'NEVER_CHECKED' as const, checkedAt: '' };
  }
  if (error) {
    return { status: 'FAILED' as const, checkedAt: lastCheckedAt ?? '', failReason: error.message };
  }
  return { status: 'COMPLETED' as const, checkedAt: lastCheckedAt ?? '' };
};

const transformInstallationStatus = (legacy: LegacyGcpInstallationStatus) => ({
  lastCheck: buildLastCheck(legacy.lastCheckedAt, legacy.error),
  resources: legacy.resources.map((r) => ({
    resourceId: r.resourceId,
    resourceName: r.resourceName,
    resourceType: r.resourceType,
    resourceSubType: r.resourceSubType ?? null,
    installationStatus: r.installationStatus,
    serviceSideSubnetCreation: r.serviceSideSubnetCreation,
    serviceSideTerraformApply: r.serviceSideTerraformApply,
    bdcSideTerraformApply: r.bdcSideTerraformApply,
  })),
});

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.gcp.getInstallationStatus(resolved.projectId);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyGcpInstallationStatus;
  return NextResponse.json(transformInstallationStatus(legacy));
});
