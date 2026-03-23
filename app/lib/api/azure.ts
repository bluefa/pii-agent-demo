import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import type { AzureV1InstallationStatus, AzureV1Settings } from '@/lib/types/azure';

const BASE_URL = '/azure/target-sources';

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

export const getAzureSettings = (
  targetSourceId: number,
): Promise<AzureV1Settings> =>
  fetchInfraCamelJson<AzureV1Settings>(`${BASE_URL}/${targetSourceId}/settings`);
