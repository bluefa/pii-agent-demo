/**
 * Real HTTP BFF client (used when USE_MOCK_DATA=false).
 */
import type { BffClient } from '@/lib/bff/types';
import type { SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ConfirmedIntegrationResponsePayload,
  ResourceCatalogResponsePayload,
} from '@/lib/bff/types/confirm';
import { BffError } from '@/lib/bff/errors';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';
import { extractConfirmedIntegration } from '@/lib/confirmed-integration-response';
import { extractResourceCatalog } from '@/lib/resource-catalog-response';

const BFF_URL = process.env.BFF_API_URL ?? '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isCurrentUser = (value: unknown): value is CurrentUser =>
  isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.email === 'string';

async function throwBffError(res: Response): Promise<never> {
  const raw = await res.json().catch(() => ({}));
  throw bffErrorFromBody(res.status, raw);
}

async function get<T>(path: string, opts?: { raw?: boolean }): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, {
    headers: { Accept: 'application/json' },
  });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  const data = await res.json();
  return (opts?.raw ? data : camelCaseKeys(data)) as T;
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
  // I-3 invariant: POST/PUT bodies are raw passthrough (snake_case), no camelCase.
  return await res.json() as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → PUT ${fullPath}`);
  const res = await fetch(fullPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  console.log(`[BFF] ← PUT ${fullPath} (${res.status})`);
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
    // Issue #222: snake_case raw passthrough — bypass camelCaseKeys.
    getScanApp: (id) => get(`/target-sources/${id}/azure/scan-app`, { raw: true }),
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

  confirm: {
    getResources: async (id) => {
      const payload = await get<ResourceCatalogResponsePayload>(`/target-sources/${id}/resources`);
      return extractResourceCatalog(payload);
    },

    createApprovalRequest: (id, body: ApprovalRequestCreateBody) =>
      post<unknown>(`/target-sources/${id}/approval-requests`, body),

    getConfirmedIntegration: async (id): Promise<BffConfirmedIntegration> => {
      const payload = await get<ConfirmedIntegrationResponsePayload>(`/target-sources/${id}/confirmed-integration`);
      return extractConfirmedIntegration(payload);
    },

    getApprovedIntegration: (id) =>
      get<unknown>(`/target-sources/${id}/approved-integration`),

    getApprovalHistory: (id, page, size) =>
      get<unknown>(`/target-sources/${id}/approval-history?page=${page}&size=${size}`),

    getApprovalRequestLatest: (id) =>
      get<unknown>(`/target-sources/${id}/approval-requests/latest`),

    getProcessStatus: (id) =>
      get<unknown>(`/target-sources/${id}/process-status`),

    approveApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests/approve`, body),

    rejectApprovalRequest: (id, body) =>
      post<unknown>(`/target-sources/${id}/approval-requests/reject`, body),

    cancelApprovalRequest: (id) =>
      post<unknown>(`/target-sources/${id}/approval-requests/cancel`, {}),

    confirmInstallation: (id) =>
      post<unknown>(`/target-sources/${id}/pii-agent-installation/confirm`, {}),

    updateResourceCredential: (id, body) =>
      put<unknown>(`/target-sources/${id}/resources/credential`, body),

    testConnection: (id, body) =>
      post<{ id?: string }>(`/target-sources/${id}/test-connection`, body),

    getTestConnectionResults: (id, page, size) =>
      get<unknown>(`/target-sources/${id}/test-connection/results?page=${page}&size=${size}`),

    getTestConnectionLatest: (id) =>
      get<unknown>(`/target-sources/${id}/test-connection/latest`),
  },
};
