import type { GcpInstallationStatusResponse, GcpServiceAccountInfo } from '@/app/api/_lib/v1-types';
import { fetchInfraCamelJson } from '@/app/lib/api/infra';

const BASE_URL = '/gcp/target-sources';

export const getGcpInstallationStatus = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchInfraCamelJson<GcpInstallationStatusResponse>(`${BASE_URL}/${targetSourceId}/installation-status`);

export const checkGcpInstallation = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchInfraCamelJson<GcpInstallationStatusResponse>(`${BASE_URL}/${targetSourceId}/check-installation`, {
    method: 'POST',
  });

export const getGcpScanServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> =>
  fetchInfraCamelJson<GcpServiceAccountInfo>(`${BASE_URL}/${targetSourceId}/scan-service-account`);

export const getGcpTerraformServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> =>
  fetchInfraCamelJson<GcpServiceAccountInfo>(`${BASE_URL}/${targetSourceId}/terraform-service-account`);
