/**
 * 실제 BFF API HTTP 클라이언트.
 * USE_MOCK_DATA=false 일 때 사용된다.
 */
import type { BffClient } from '@/lib/bff/types';
import type { SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { BffError } from '@/lib/bff/errors';
import { extractBffError, type BffErrorBody } from '@/app/api/_lib/problem';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';

const BFF_URL = process.env.BFF_API_URL ?? '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCurrentUser = (value: unknown): value is CurrentUser =>
  isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.email === 'string';

async function throwBffError(res: Response): Promise<never> {
  // Use shared extractBffError so nested { error: { code, message } } and flat
  // shapes parity-match transformLegacyError (problem.ts).
  const raw = await res.json().catch((): BffErrorBody => ({}));
  const { code, message } = extractBffError(raw as BffErrorBody);
  throw new BffError(
    res.status,
    code || 'INTERNAL_ERROR',
    message || `HTTP ${res.status}`,
  );
}

async function get<T>(path: string): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, {
    headers: { Accept: 'application/json' },
  });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  const data = await res.json();
  return camelCaseKeys(data) as T;
}

async function getRaw<T>(path: string): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, {
    headers: { Accept: 'application/json' },
  });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  return await res.json() as T;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → POST ${fullPath}`);
  const res = await fetch(fullPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  console.log(`[BFF] ← POST ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  return await res.json() as T;
}

export const httpBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const data = await get<TargetSourceDetailResponse>(`/target-sources/${id}`);
      return extractTargetSource(data);
    },

    secrets: async (id) => {
      const data = await get<Array<{ name: string; createTime: string | null; createTimeStr: string | null }>>(`/target-sources/${id}/secrets`);
      return data.map((c): SecretKey => ({
        name: c.name,
        createTimeStr: c.createTimeStr ?? '',
      }));
    },
  },

  users: {
    me: async () => {
      const data = await get<unknown>('/user/me');
      const candidate = isRecord(data) && isRecord(data.user) ? data.user : data;
      if (!isCurrentUser(candidate)) {
        throw new BffError(502, 'INVALID_RESPONSE_SHAPE', 'Invalid CurrentUser response shape');
      }
      return candidate;
    },
  },

  aws: {
    checkInstallation: (id) => post(`/aws/projects/${id}/check-installation`, {}),
    setInstallationMode: (id, body) => post(`/aws/projects/${id}/installation-mode`, body),
    getInstallationStatus: (id) => get(`/aws/projects/${id}/installation-status`),
    getTerraformScript: (id) => get(`/aws/projects/${id}/terraform-script`),
    verifyTfRole: (_id, body) => post('/aws/verify-tf-role', body ?? {}),
  },

  azure: {
    checkInstallation: (id) => post(`/target-sources/${id}/azure/check-installation`, {}),
    getInstallationStatus: (id) => get(`/target-sources/${id}/azure/installation-status`),
    getSettings: (id) => get(`/target-sources/${id}/azure/settings`),
    getSubnetGuide: (id) => get(`/target-sources/${id}/azure/subnet-guide`),
    // Issue #222: bypass camelCaseKeys to preserve snake_case payload.
    getScanApp: (id) => getRaw(`/target-sources/${id}/azure/scan-app`),
    vmCheckInstallation: (id) => post(`/target-sources/${id}/azure/vm/check-installation`, {}),
    vmGetInstallationStatus: (id) => get(`/target-sources/${id}/azure/vm/installation-status`),
    vmGetTerraformScript: (id) => get(`/target-sources/${id}/azure/vm/terraform-script`),
  },

  gcp: {
    checkInstallation: (id) => post(`/target-sources/${id}/gcp/check-installation`, {}),
    getInstallationStatus: (id) => get(`/target-sources/${id}/gcp/installation-status`),
    getScanServiceAccount: (id) => get(`/target-sources/${id}/gcp/scan-service-account`),
    getTerraformServiceAccount: (id) => get(`/target-sources/${id}/gcp/terraform-service-account`),
  },
};
