import { fetchJson } from '@/lib/fetch-json';
import type { AzureV1InstallationStatus, AzureV1Settings } from '@/lib/types/azure';

const BASE_URL = '/api/v1/azure/target-sources';

export const getAzureInstallationStatus = (
  targetSourceId: number,
): Promise<AzureV1InstallationStatus> =>
  fetchJson<AzureV1InstallationStatus>(`${BASE_URL}/${targetSourceId}/installation-status`);

export const checkAzureInstallation = (
  targetSourceId: number,
): Promise<AzureV1InstallationStatus> =>
  fetchJson<AzureV1InstallationStatus>(`${BASE_URL}/${targetSourceId}/check-installation`, {
    method: 'POST',
  });

export const getAzureSettings = (
  targetSourceId: number,
): Promise<AzureV1Settings> =>
  fetchJson<AzureV1Settings>(`${BASE_URL}/${targetSourceId}/settings`);
