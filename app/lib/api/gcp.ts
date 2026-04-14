import type { GcpInstallationStatusResponse, GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';
import { fetchInfraCamelJson } from '@/app/lib/api/infra';
import { client } from '@/lib/api-client';

// GCP installation status uses existing endpoint structure
export const getGcpInstallationStatus = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchInfraCamelJson<GcpInstallationStatusResponse>(`/gcp/target-sources/${targetSourceId}/installation-status`);

// Other GCP APIs maintain original endpoint structure
const BASE_URL = '/gcp/target-sources';

export const checkGcpInstallation = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchInfraCamelJson<GcpInstallationStatusResponse>(`${BASE_URL}/${targetSourceId}/check-installation`, {
    method: 'POST',
  });

export const getGcpScanServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> => {
  return fetchInfraCamelJson<GcpServiceAccountInfo>(`/gcp/target-sources/${targetSourceId}/scan-service-account`);
};

export const getGcpTerraformServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> => {
  return fetchInfraCamelJson<GcpServiceAccountInfo>(`/gcp/target-sources/${targetSourceId}/terraform-service-account`);
};
