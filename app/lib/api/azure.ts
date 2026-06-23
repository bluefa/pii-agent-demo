import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import type { AzureV1InstallationStatus } from '@/lib/types/azure';
import type { AzureHealthCheckResult } from '@/lib/bff/types/azure';

const BASE_URL = '/azure/target-sources';
const TARGET_SOURCE_BASE_URL = '/target-sources';
const INFRA_TARGET_SOURCE_BASE_URL = '/infra/target-sources';

export interface AzureScanApp {
  appId: string;
  status: 'VALID' | 'INVALID' | 'UNVERIFIED' | string;
  failReason?: string;
  failMessage?: string;
  lastVerifiedAt?: string;
}

/**
 * Azure 설치 상태 조회.
 * Refresh is a re-GET of this endpoint (the old POST check-installation is not
 * in install-v1.yaml — REMOVED).
 */
export const getAzureInstallationStatus = (
  targetSourceId: number,
): Promise<AzureV1InstallationStatus> =>
  fetchInfraCamelJson<AzureV1InstallationStatus>(`${BASE_URL}/${targetSourceId}/installation-status`);

export const getAzureScanApp = (
  targetSourceId: number,
): Promise<AzureScanApp> =>
  fetchInfraCamelJson<AzureScanApp>(`${TARGET_SOURCE_BASE_URL}/${targetSourceId}/azure/scan-app`);

/** G8 — Azure Private Link health check (wire already camelCase per swagger). */
export const getAzurePrivateLinkHealthCheck = (
  targetSourceId: number,
): Promise<AzureHealthCheckResult> =>
  fetchInfraCamelJson<AzureHealthCheckResult>(
    `${INFRA_TARGET_SOURCE_BASE_URL}/${targetSourceId}/azure-private-link-health-check`,
  );
