import type { BaseTargetSource, TargetSource } from '@/lib/types';
import { ProcessStatus, normalizeCloudProvider } from '@/lib/types';

export interface TargetSourceEnvelopeResponse {
  targetSource: TargetSource | Record<string, unknown>;
}

export type TargetSourceDetailResponse =
  | TargetSource
  | Record<string, unknown>
  | TargetSourceEnvelopeResponse;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const parseTargetSourceId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
};

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

const unwrapTargetSourcePayload = (
  payload: TargetSourceDetailResponse,
): TargetSource | Record<string, unknown> => {
  if (isRecord(payload) && 'targetSource' in payload && isRecord(payload.targetSource)) {
    return payload.targetSource;
  }

  return payload as TargetSource | Record<string, unknown>;
};

const normalizeTargetSource = (value: TargetSource | Record<string, unknown>): TargetSource => {
  if (!isRecord(value)) {
    throw new Error('target source payload must be an object');
  }

  const targetSourceId = parseTargetSourceId(value.targetSourceId);
  if (targetSourceId === null) {
    throw new Error('targetSourceId is missing from target source payload');
  }

  const createdAt = asString(value.createdAt) ?? new Date().toISOString();
  const processStatus = normalizeTargetSourceProcessStatus(value.processStatus);
  const cloudProvider = normalizeCloudProvider(value.cloudProvider);
  const metadata = isRecord(value.metadata) ? value.metadata : null;
  const projectCode = asString(value.projectCode)?.trim() ?? '';
  const name = asString(value.name) ?? (projectCode || `TS-${targetSourceId}`);
  const rejectionReason = asString(value.rejectionReason);

  const base: BaseTargetSource = {
    id: asString(value.id) ?? `target-source-${targetSourceId}`,
    targetSourceId,
    projectCode,
    serviceCode: asString(value.serviceCode)?.trim() ?? '',
    processStatus,
    createdAt,
    updatedAt: asString(value.updatedAt) ?? createdAt,
    name,
    description: asString(value.description) ?? '',
    isRejected: Boolean(value.isRejected),
    ...(rejectionReason ? { rejectionReason } : {}),
  };

  const tenantId = asString(value.tenantId)
    ?? (metadata ? asString(metadata.tenantId) : undefined);
  const subscriptionId = asString(value.subscriptionId)
    ?? (metadata ? asString(metadata.subscriptionId) : undefined);
  const awsAccountId = asString(value.awsAccountId)
    ?? (metadata ? asString(metadata.awsAccountId) : undefined);
  const awsRegionTypeRaw = asString(value.awsRegionType)
    ?? (metadata ? asString(metadata.awsRegionType) : undefined);
  const awsRegionType = awsRegionTypeRaw === 'china' || awsRegionTypeRaw === 'global'
    ? awsRegionTypeRaw
    : undefined;
  const gcpProjectId = asString(value.gcpProjectId)
    ?? (metadata ? asString(metadata.gcpProjectId) : undefined);

  return {
    ...base,
    cloudProvider,
    ...(tenantId ? { tenantId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(awsAccountId ? { awsAccountId } : {}),
    ...(awsRegionType ? { awsRegionType } : {}),
    ...(gcpProjectId ? { gcpProjectId } : {}),
  };
};

export const extractTargetSource = (payload: TargetSourceDetailResponse): TargetSource =>
  normalizeTargetSource(unwrapTargetSourcePayload(payload));
