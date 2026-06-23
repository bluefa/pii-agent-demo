import { fetchInfraCamelJson, fetchInfraJson } from '@/app/lib/api/infra';
import type {
  AwsInstallationStatus,
  AwsSettings,
  TerraformScriptResponse,
} from '@/lib/types';

const BASE = '/aws/target-sources';

/**
 * AWS 설정 조회 (Execution Role + Scan Role)
 * TODO(L3): /aws/.../settings is NOT in install-v1.yaml (removed endpoint).
 * Replace callers with verifyScanRole/verifyExecutionRole; remove this fn.
 */
export const getAwsSettings = (targetSourceId: number): Promise<AwsSettings> =>
  fetchInfraCamelJson<AwsSettings>(`${BASE}/${targetSourceId}/settings`);

/**
 * AWS 설치 상태 조회
 */
export const getAwsInstallationStatus = (targetSourceId: number): Promise<AwsInstallationStatus> =>
  fetchInfraCamelJson<AwsInstallationStatus>(`${BASE}/${targetSourceId}/installation-status`);

/**
 * AWS 설치 상태 실시간 동기화 (새로고침)
 * TODO(L3): /aws/.../check-installation is NOT in install-v1.yaml (removed
 * endpoint). Refresh = re-GET installation-status; remove this fn + its callers.
 */
export const checkAwsInstallation = (targetSourceId: number): Promise<AwsInstallationStatus> =>
  fetchInfraCamelJson<AwsInstallationStatus>(`${BASE}/${targetSourceId}/check-installation`, { method: 'POST' });

/**
 * TF Script 다운로드 (수동 설치용)
 * TODO(L3): swagger getAwsTerraformScript returns a binary download
 * (…/aws/terraform-script/download, application/octet-stream), not JSON
 * { downloadUrl }. UI must switch to a blob download.
 */
export const getAwsTerraformScript = (targetSourceId: number): Promise<TerraformScriptResponse> =>
  fetchInfraCamelJson<TerraformScriptResponse>(`${BASE}/${targetSourceId}/terraform-script`);

/**
 * AWS 설치 모드 설정 (AUTO/MANUAL)
 * TODO(L3): /aws/.../installation-mode is NOT in install-v1.yaml (removed
 * endpoint). Remove this fn + its callers.
 */
export const setAwsInstallationMode = (
  targetSourceId: number,
  mode: 'AUTO' | 'MANUAL'
): Promise<{ success: boolean; project: unknown }> =>
  fetchInfraJson(`${BASE}/${targetSourceId}/installation-mode`, {
    method: 'POST',
    body: { mode },
  });
