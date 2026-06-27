import { fetchInfraJson } from '@/app/lib/api/infra';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

const BASE_URL = '/azure/target-sources';
const TARGET_SOURCE_BASE_URL = '/target-sources';
const INFRA_TARGET_SOURCE_BASE_URL = '/infra/target-sources';

/**
 * Azure 설치 상태 조회 — returns validated snake wire type.
 * Refresh is a re-GET of this endpoint (the old POST check-installation is not
 * in install-v1.yaml — REMOVED).
 * Caller passes through buildAzureInstallationStatus() for the camel UI view.
 */
export const getAzureInstallationStatus = (
  targetSourceId: number,
): Promise<z.infer<typeof schemas.AzureInstallationStatusResponse>> =>
  fetchInfraJson(`${BASE_URL}/${targetSourceId}/installation-status`);

/** Issue #222: snake_case raw passthrough (scan-app uses getSnakeRaw at the route). */
export const getAzureScanApp = (
  targetSourceId: number,
): Promise<z.infer<typeof schemas.AzureServicePrincipalVerificationResponse>> =>
  fetchInfraJson(`${TARGET_SOURCE_BASE_URL}/${targetSourceId}/azure/scan-app`);

/** G8 — Azure Private Link health check (wire already camelCase per swagger). */
export const getAzurePrivateLinkHealthCheck = (
  targetSourceId: number,
): Promise<z.infer<typeof schemas.AzureHealthCheckResult>> =>
  fetchInfraJson(
    `${INFRA_TARGET_SOURCE_BASE_URL}/${targetSourceId}/azure-private-link-health-check`,
  );
