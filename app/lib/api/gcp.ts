import { fetchInfraJson } from '@/app/lib/api/infra';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

const BASE_URL = '/gcp/target-sources';

/**
 * GCP 설치 상태 조회 (ADR-019 zod-codegen).
 * Returns the raw snake wire type; consumers call the CSR adapter for reshape.
 */
export const getGcpInstallationStatus = async (
  targetSourceId: number
): Promise<z.infer<typeof schemas.GcpInstallationStatusResponse>> =>
  fetchInfraJson(`${BASE_URL}/${targetSourceId}/installation-status`);

export const getGcpScanServiceAccount = async (
  targetSourceId: number
): Promise<z.infer<typeof schemas.GcpServiceAccountInfoResponse>> =>
  fetchInfraJson(`${BASE_URL}/${targetSourceId}/scan-service-account`);

export const getGcpTerraformServiceAccount = async (
  targetSourceId: number
): Promise<z.infer<typeof schemas.GcpServiceAccountInfoResponse>> =>
  fetchInfraJson(`${BASE_URL}/${targetSourceId}/terraform-service-account`);
