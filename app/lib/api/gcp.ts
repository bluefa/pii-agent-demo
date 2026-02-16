import type { GcpInstallationStatusResponse } from '@/app/api/_lib/v1-types';
import { fetchJson } from '@/lib/fetch-json';

const BASE_URL = '/api/v1/gcp/target-sources';

export const getGcpInstallationStatus = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchJson<GcpInstallationStatusResponse>(`${BASE_URL}/${targetSourceId}/installation-status`);

export const checkGcpInstallation = async (
  targetSourceId: number
): Promise<GcpInstallationStatusResponse> =>
  fetchJson<GcpInstallationStatusResponse>(`${BASE_URL}/${targetSourceId}/check-installation`, {
    method: 'POST',
  });
