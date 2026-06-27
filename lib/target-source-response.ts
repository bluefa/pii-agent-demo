/**
 * TargetSourceDetail (snake wire) → TargetSource domain model.
 *
 * ADR-019: bff.targetSources.get returns raw snake TargetSourceDetail.
 * extractTargetSourceFromSnake is the single boundary for SSR pages that call
 * the BFF directly. CSR callers use getProject in app/lib/api/index.ts.
 */
import type { TargetSource } from '@/lib/types';
import { ProcessStatus, normalizeCloudProvider } from '@/lib/types';
import type { schemas } from '@/lib/generated/install-v1';
import type { z } from 'zod';

type TargetSourceDetailWire = z.infer<typeof schemas.TargetSourceDetail>;

export const normalizeTargetSourceProcessStatus = (value: unknown): ProcessStatus => {
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

/** SSR adapter: snake TargetSourceDetail (from bff.targetSources.get) → TargetSource. */
export const extractTargetSourceFromSnake = (raw: TargetSourceDetailWire): TargetSource => {
  const item = raw as Record<string, unknown>;
  const asStr = (v: unknown): string | undefined => typeof v === 'string' ? v : undefined;

  const id = typeof item.target_source_id === 'number' ? item.target_source_id : 0;
  const fallbackCode = `TS-${id}`;
  const serviceCode = asStr(item.service_code)?.trim() ?? '';
  const processStatus = normalizeTargetSourceProcessStatus(asStr(item.process_status));
  const metadata = (typeof item.metadata === 'object' && item.metadata !== null)
    ? item.metadata as Record<string, unknown>
    : null;

  const tenantId = asStr(metadata?.tenant_id);
  const subscriptionId = asStr(metadata?.subscription_id);
  const awsAccountId = asStr(metadata?.aws_account_id);
  const gcpProjectId = asStr(metadata?.gcp_project_id);
  const awsInstallationModeRaw = asStr(item.aws_installation_mode);
  const awsInstallationMode =
    awsInstallationModeRaw === 'AUTO' || awsInstallationModeRaw === 'MANUAL'
      ? awsInstallationModeRaw
      : undefined;
  const createdAt = asStr(item.created_at) ?? new Date().toISOString();

  return {
    id: fallbackCode,
    targetSourceId: id,
    projectCode: serviceCode || fallbackCode,
    serviceCode,
    serviceName: asStr(item.service_name)?.trim() || serviceCode,
    processStatus,
    cloudProvider: normalizeCloudProvider(asStr(item.cloud_provider)),
    createdAt,
    updatedAt: asStr(item.updated_at) ?? createdAt,
    name: fallbackCode,
    description: asStr(item.description) ?? '',
    isRejected: false,
    ...(tenantId ? { tenantId } : {}),
    ...(subscriptionId ? { subscriptionId } : {}),
    ...(awsAccountId ? { awsAccountId } : {}),
    ...(gcpProjectId ? { gcpProjectId } : {}),
    ...(awsInstallationMode ? { awsInstallationMode } : {}),
  };
};
