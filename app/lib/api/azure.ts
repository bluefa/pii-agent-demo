import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import type { AzureV1InstallationStatus, AzureV1Settings } from '@/lib/types/azure';

const BASE_URL = '/azure/target-sources';
const TARGET_SOURCE_BASE_URL = '/target-sources';

export interface AzureScanApp {
  appId: string;
  status: 'VALID' | 'INVALID' | 'UNVERIFIED' | string;
  failReason?: string;
  failMessage?: string;
  lastVerifiedAt?: string;
}

export interface AzureProjectIdentifiers {
  tenantId?: string;
  subscriptionId?: string;
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

export const resolveAzureProjectIdentifiers = (
  projectIdentifiers: AzureProjectIdentifiers,
  fallbackSettings: AzureV1Settings | null,
): AzureProjectIdentifiers => ({
  tenantId: projectIdentifiers.tenantId ?? fallbackSettings?.tenantId,
  subscriptionId: projectIdentifiers.subscriptionId ?? fallbackSettings?.subscriptionId,
});

export const getAzureSettings = (
  targetSourceId: number,
  options?: { signal?: AbortSignal },
): Promise<AzureV1Settings> =>
  fetchInfraCamelJson<AzureV1Settings>(
    `${BASE_URL}/${targetSourceId}/settings`,
    options?.signal ? { signal: options.signal } : undefined,
  );
