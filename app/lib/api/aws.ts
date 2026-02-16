import { fetchJson } from '@/lib/fetch-json';
import type {
  AwsInstallationStatus,
  AwsSettings,
  TerraformScriptResponse,
} from '@/lib/types';

const BASE = '/api/v1/aws/target-sources';

/**
 * AWS 설정 조회 (Execution Role + Scan Role)
 */
export const getAwsSettings = (targetSourceId: number): Promise<AwsSettings> =>
  fetchJson<AwsSettings>(`${BASE}/${targetSourceId}/settings`);

/**
 * AWS 설치 상태 조회
 */
export const getAwsInstallationStatus = (targetSourceId: number): Promise<AwsInstallationStatus> =>
  fetchJson<AwsInstallationStatus>(`${BASE}/${targetSourceId}/installation-status`);

/**
 * AWS 설치 상태 실시간 동기화 (새로고침)
 */
export const checkAwsInstallation = (targetSourceId: number): Promise<AwsInstallationStatus> =>
  fetchJson<AwsInstallationStatus>(`${BASE}/${targetSourceId}/check-installation`, { method: 'POST' });

/**
 * TF Script 다운로드 URL 조회 (수동 설치용)
 */
export const getAwsTerraformScript = (targetSourceId: number): Promise<TerraformScriptResponse> =>
  fetchJson<TerraformScriptResponse>(`${BASE}/${targetSourceId}/terraform-script`);

/**
 * AWS 설치 모드 설정 (AUTO/MANUAL)
 */
export const setAwsInstallationMode = (
  targetSourceId: number,
  mode: 'AUTO' | 'MANUAL'
): Promise<{ success: boolean; project: unknown }> =>
  fetchJson(`${BASE}/${targetSourceId}/installation-mode`, {
    method: 'POST',
    body: { mode },
  });
