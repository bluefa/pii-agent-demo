import { fetchInfra, fetchInfraJson } from '@/app/lib/api/infra';
import type { AwsInstallationStatus } from '@/lib/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { transformAwsInstallationStatus } from '@/app/integration/api/v1/aws/target-sources/_lib/installation-transform';

const BASE = '/aws/target-sources';

/**
 * AWS 설치 상태 조회.
 * Route validates raw BFF response with schemas.AwsInstallationStatusResponse.parse();
 * this CSR function applies the reshape adapter (snake wire → UI domain).
 */
export const getAwsInstallationStatus = async (targetSourceId: number): Promise<AwsInstallationStatus> => {
  const raw = await fetchInfraJson<z.infer<typeof schemas.AwsInstallationStatusResponse>>(
    `${BASE}/${targetSourceId}/installation-status`,
  );
  return transformAwsInstallationStatus(raw);
};

/**
 * TF Script 다운로드 (수동 설치용).
 * swagger getAwsTerraformScript returns a binary download
 * (…/aws/terraform-script/download → application/octet-stream); the internal
 * route streams it. Returns the response Blob for the caller to save.
 */
export const getAwsTerraformScript = async (targetSourceId: number): Promise<Blob> => {
  const res = await fetchInfra(`${BASE}/${targetSourceId}/terraform-script`);
  if (!res.ok) throw new Error(`terraform-script download failed (${res.status})`);
  return res.blob();
};
