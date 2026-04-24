import { createInitialProjectStatus } from '@/lib/process';
import type { Project, ProjectStatus, TerraformState } from '@/lib/types';
import { ProcessStatus, normalizeCloudProvider } from '@/lib/types';

export interface TargetSourceEnvelopeResponse {
  targetSource: Project | Record<string, unknown>;
}

export interface TargetSourceSnakeEnvelopeResponse {
  target_source: Project | Record<string, unknown>;
}

export interface LegacyProjectEnvelopeResponse {
  project: Project | Record<string, unknown>;
}

export type TargetSourceDetailResponse =
  | Project
  | Record<string, unknown>
  | TargetSourceEnvelopeResponse
  | TargetSourceSnakeEnvelopeResponse
  | LegacyProjectEnvelopeResponse;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const readValue = (record: Record<string, unknown>, ...keys: string[]): unknown => {
  for (const key of keys) {
    if (key in record) return record[key];
  }

  return undefined;
};

const readString = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  const value = readValue(record, ...keys);
  return typeof value === 'string' ? value : undefined;
};

const parseTargetSourceId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
};

const isProjectStatus = (value: unknown): value is ProjectStatus => (
  isRecord(value)
  && isRecord(value.scan)
  && isRecord(value.targets)
  && isRecord(value.approval)
  && isRecord(value.installation)
  && isRecord(value.connectionTest)
);

const isTerraformState = (value: unknown): value is TerraformState => (
  isRecord(value)
  && typeof value.bdcTf === 'string'
);

const isProject = (value: unknown): value is Project => (
  isRecord(value)
  && typeof value.id === 'string'
  && typeof value.targetSourceId === 'number'
  && Array.isArray(value.resources)
  && isProjectStatus(value.status)
  && isTerraformState(value.terraformState)
);

export const normalizeTargetSourceProcessStatus = (value: unknown): ProcessStatus => {
  if (typeof value === 'number' && ProcessStatus[value] !== undefined) {
    return value as ProcessStatus;
  }

  switch (String(value).trim().toUpperCase()) {
    case 'WAITING_APPROVAL':
    case 'PENDING':
      return ProcessStatus.WAITING_APPROVAL;
    case 'APPLYING_APPROVED':
    case 'CONFIRMING':
      return ProcessStatus.APPLYING_APPROVED;
    case 'CONFIRMED':
      return ProcessStatus.INSTALLING;
    case 'INSTALLED':
      return ProcessStatus.WAITING_CONNECTION_TEST;
    case 'CONNECTED':
      return ProcessStatus.CONNECTION_VERIFIED;
    case 'TARGET_CONFIRMED':
    case 'COMPLETED':
      return ProcessStatus.INSTALLATION_COMPLETE;
    case 'REQUEST_REQUIRED':
    case 'IDLE':
    default:
      return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }
};

const buildDerivedStatus = (
  processStatus: ProcessStatus,
  createdAt: string,
): ProjectStatus => {
  const status = createInitialProjectStatus();

  switch (processStatus) {
    case ProcessStatus.WAITING_APPROVAL:
      status.targets.confirmed = true;
      return status;
    case ProcessStatus.APPLYING_APPROVED:
      status.targets.confirmed = true;
      status.approval.status = 'APPROVED';
      return status;
    case ProcessStatus.INSTALLING:
      status.targets.confirmed = true;
      status.approval.status = 'APPROVED';
      status.installation.status = 'IN_PROGRESS';
      return status;
    case ProcessStatus.WAITING_CONNECTION_TEST:
      status.targets.confirmed = true;
      status.approval.status = 'APPROVED';
      status.installation.status = 'COMPLETED';
      return status;
    case ProcessStatus.CONNECTION_VERIFIED:
      status.targets.confirmed = true;
      status.approval.status = 'APPROVED';
      status.installation.status = 'COMPLETED';
      status.connectionTest.status = 'PASSED';
      status.connectionTest.passedAt = createdAt;
      return status;
    case ProcessStatus.INSTALLATION_COMPLETE:
      status.targets.confirmed = true;
      status.approval.status = 'APPROVED';
      status.installation.status = 'COMPLETED';
      status.connectionTest.status = 'PASSED';
      status.connectionTest.passedAt = createdAt;
      status.connectionTest.operationConfirmed = true;
      return status;
    case ProcessStatus.WAITING_TARGET_CONFIRMATION:
    default:
      return status;
  }
};

const buildTerraformState = (
  cloudProvider: Project['cloudProvider'],
  terraformState: unknown,
): TerraformState => {
  if (isTerraformState(terraformState)) return terraformState;

  if (cloudProvider === 'AWS') {
    return {
      serviceTf: 'PENDING',
      bdcTf: 'PENDING',
    };
  }

  return { bdcTf: 'PENDING' };
};

const unwrapTargetSourcePayload = (payload: TargetSourceDetailResponse): Project | Record<string, unknown> => {
  if (isRecord(payload) && 'targetSource' in payload && isRecord(payload.targetSource)) {
    return payload.targetSource;
  }

  if (isRecord(payload) && 'target_source' in payload && isRecord(payload.target_source)) {
    return payload.target_source;
  }

  if (isRecord(payload) && 'project' in payload && isRecord(payload.project)) {
    return payload.project;
  }

  return payload as Project | Record<string, unknown>;
};

const normalizeTargetSource = (value: Project | Record<string, unknown>): Project => {
  if (isProject(value)) return value;
  if (!isRecord(value)) {
    throw new Error('target source payload must be an object');
  }

  const targetSourceId = parseTargetSourceId(
    readValue(value, 'targetSourceId', 'target_source_id'),
  );

  if (targetSourceId === null) {
    throw new Error('targetSourceId is missing from target source payload');
  }

  const createdAt = readString(value, 'createdAt', 'created_at') ?? new Date().toISOString();
  const processStatus = normalizeTargetSourceProcessStatus(
    readValue(value, 'processStatus', 'process_status'),
  );
  const cloudProvider = normalizeCloudProvider(
    readValue(value, 'cloudProvider', 'cloud_provider'),
  );
  const metadata = readValue(value, 'metadata');
  const metadataRecord = isRecord(metadata) ? metadata : null;
  const projectCode = readString(value, 'projectCode', 'project_code')?.trim() ?? '';
  const tenantId = readString(value, 'tenantId', 'tenant_id')
    ?? (metadataRecord ? readString(metadataRecord, 'tenantId', 'tenant_id') : undefined);
  const subscriptionId = readString(value, 'subscriptionId', 'subscription_id')
    ?? (metadataRecord ? readString(metadataRecord, 'subscriptionId', 'subscription_id') : undefined);
  const awsAccountId = readString(value, 'awsAccountId', 'aws_account_id')
    ?? (metadataRecord ? readString(metadataRecord, 'awsAccountId', 'aws_account_id') : undefined);
  const awsRegionTypeRaw = readString(value, 'awsRegionType', 'aws_region_type')
    ?? (metadataRecord ? readString(metadataRecord, 'awsRegionType', 'aws_region_type') : undefined);
  const awsRegionType = awsRegionTypeRaw === 'china' || awsRegionTypeRaw === 'global'
    ? awsRegionTypeRaw
    : undefined;
  const gcpProjectId = readString(value, 'gcpProjectId', 'gcp_project_id')
    ?? (metadataRecord ? readString(metadataRecord, 'gcpProjectId', 'gcp_project_id') : undefined);
  const name = readString(value, 'name') ?? (projectCode || `TS-${targetSourceId}`);

  return {
    id: readString(value, 'id') ?? `target-source-${targetSourceId}`,
    targetSourceId,
    projectCode,
    serviceCode: readString(value, 'serviceCode', 'service_code')?.trim() ?? '',
    cloudProvider,
    processStatus,
    status: isProjectStatus(value.status)
      ? value.status
      : buildDerivedStatus(processStatus, createdAt),
    resources: Array.isArray(value.resources) ? value.resources as Project['resources'] : [],
    terraformState: buildTerraformState(cloudProvider, value.terraformState),
    createdAt,
    updatedAt: readString(value, 'updatedAt', 'updated_at') ?? createdAt,
    name,
    description: readString(value, 'description') ?? '',
    isRejected: Boolean(readValue(value, 'isRejected', 'is_rejected')),
    ...(readString(value, 'rejectionReason', 'rejection_reason')
      ? { rejectionReason: readString(value, 'rejectionReason', 'rejection_reason') }
      : {}),
    ...(tenantId ? { tenantId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(awsAccountId ? { awsAccountId } : {}),
    ...(awsRegionType ? { awsRegionType } : {}),
    ...(gcpProjectId ? { gcpProjectId } : {}),
  };
};

export const extractTargetSource = (payload: TargetSourceDetailResponse): Project =>
  normalizeTargetSource(unwrapTargetSourcePayload(payload));
