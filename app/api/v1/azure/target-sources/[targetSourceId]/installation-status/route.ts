import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

interface LegacyPrivateEndpoint {
  id: string;
  name: string;
  status: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface LegacyResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  privateEndpoint: LegacyPrivateEndpoint;
}

interface LegacyInstallationStatus {
  provider: string;
  installed: boolean;
  resources: LegacyResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

const buildLastCheck = (lastCheckedAt?: string, error?: { code: string; message: string }) => {
  if (error) {
    return { status: 'FAILED' as const, checkedAt: lastCheckedAt, failReason: error.message };
  }
  if (lastCheckedAt) {
    return { status: 'SUCCESS' as const, checkedAt: lastCheckedAt };
  }
  return { status: 'SUCCESS' as const };
};

const transformResource = (r: LegacyResource) => ({
  resourceId: r.resourceId,
  resourceName: r.resourceName,
  resourceType: r.resourceType,
  isVm: r.resourceType === 'AZURE_VM',
  privateEndpoint: {
    id: r.privateEndpoint.id,
    name: r.privateEndpoint.name,
    status: r.privateEndpoint.status,
  },
});

export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const response = await client.azure.getInstallationStatus(resolved.projectId);
  if (!response.ok) return response;

  const legacy = await response.json() as LegacyInstallationStatus;
  const resources = legacy.resources.map(transformResource);

  return NextResponse.json({
    hasVm: resources.some(r => r.isVm),
    lastCheck: buildLastCheck(legacy.lastCheckedAt, legacy.error),
    resources,
  });
}, { errorFormat: 'nested' });
