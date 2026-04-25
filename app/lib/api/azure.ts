import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import type { AzureV1InstallationStatus } from '@/lib/types/azure';

const BASE_URL = '/azure/target-sources';
const TARGET_SOURCE_BASE_URL = '/target-sources';

export interface AzureScanApp {
  appId: string;
  status: 'VALID' | 'INVALID' | 'UNVERIFIED' | string;
  failReason?: string;
  failMessage?: string;
  lastVerifiedAt?: string;
}

export const getAzureInstallationStatus = (
  targetSourceId: number,
): Promise<AzureV1InstallationStatus> =>
  fetchInfraCamelJson<AzureV1InstallationStatus>(`${BASE_URL}/${targetSourceId}/installation-status`);

export const checkAzureInstallation = (
  targetSourceId: number,
): Promise<AzureV1InstallationStatus> =>
  fetchInfraCamelJson<AzureV1InstallationStatus>(`${BASE_URL}/${targetSourceId}/check-installation`, {
    method: 'POST',
  });

export const getAzureScanApp = (
  targetSourceId: number,
): Promise<AzureScanApp> =>
  fetchInfraCamelJson<AzureScanApp>(`${TARGET_SOURCE_BASE_URL}/${targetSourceId}/azure/scan-app`);
