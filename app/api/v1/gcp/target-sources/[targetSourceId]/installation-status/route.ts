import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { problemResponse } from '@/app/api/_lib/problem';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { client } from '@/lib/api-client';

interface LegacyRegionalManagedProxy {
  exists: boolean;
  networkProjectId: string;
  vpcName: string;
  cloudSqlRegion: string;
  subnetName?: string;
  subnetCidr?: string;
}

interface LegacyPscConnection {
  status: 'NOT_REQUESTED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  connectionId?: string;
  serviceAttachmentUri?: string;
  requestedAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
}

interface LegacyGcpResource {
  id: string;
  name: string;
  resourceType: 'CLOUD_SQL' | 'BIGQUERY';
  connectionType: string;
  databaseType: string;
  serviceTfStatus: string;
  bdcTfStatus: string;
  regionalManagedProxy?: LegacyRegionalManagedProxy;
  pscConnection?: LegacyPscConnection;
  isCompleted: boolean;
}

interface LegacyGcpInstallationStatus {
  provider: 'GCP';
  resources: LegacyGcpResource[];
  lastCheckedAt?: string;
  error?: { code: string; message: string };
}

type GcpActionType = 'CREATE_PROXY_SUBNET' | 'APPROVE_PSC_CONNECTION';

const buildLastCheck = (lastCheckedAt?: string, error?: { code: string; message: string }) => {
  if (error) {
    return { status: 'FAILED' as const, checkedAt: lastCheckedAt, failReason: error.message };
  }
  if (lastCheckedAt) {
    return { status: 'SUCCESS' as const, checkedAt: lastCheckedAt };
  }
  return { status: 'SUCCESS' as const };
};

const derivePendingAction = (r: LegacyGcpResource): GcpActionType | null => {
  if (r.regionalManagedProxy?.exists === false) return 'CREATE_PROXY_SUBNET';
  if (r.pscConnection?.status === 'PENDING_APPROVAL' || r.pscConnection?.status === 'REJECTED') return 'APPROVE_PSC_CONNECTION';
  return null;
};

const transformResource = (r: LegacyGcpResource) => ({
  id: r.id,
  name: r.name,
  resourceType: r.resourceType,
  serviceTfStatus: r.serviceTfStatus,
  bdcTfStatus: r.bdcTfStatus,
  isInstallCompleted: r.isCompleted,
  pendingAction: derivePendingAction(r),
  ...(r.regionalManagedProxy && {
    regionalManagedProxy: {
      exists: r.regionalManagedProxy.exists,
      networkProjectId: r.regionalManagedProxy.networkProjectId,
      vpcName: r.regionalManagedProxy.vpcName,
    },
  }),
  ...(r.pscConnection && {
    pscConnection: {
      status: r.pscConnection.status,
      ...(r.pscConnection.connectionId && { connectionId: r.pscConnection.connectionId }),
      ...(r.pscConnection.serviceAttachmentUri && { serviceAttachmentUri: r.pscConnection.serviceAttachmentUri }),
    },
  }),
});

const transformInstallationStatus = (legacy: LegacyGcpInstallationStatus) => ({
  provider: legacy.provider,
  lastCheck: buildLastCheck(legacy.lastCheckedAt, legacy.error),
  resources: legacy.resources.map(transformResource),
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
