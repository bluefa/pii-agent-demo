/**
 * Real BFF API HTTP client. Used when USE_MOCK_DATA=false.
 *
 * Per ADR-011 README §"Observable Behavior Invariants" I-3, GET responses
 * are camelCased (matches legacy `proxyGet` behavior); POST/PUT/DELETE
 * responses are raw passthrough (matches legacy `proxyPost/Put/Delete`).
 * Resolving the asymmetry is a separate post-migration ADR.
 */
import type { BffClient } from '@/lib/bff/types';
import type { CreateTargetSourceResult } from '@/lib/bff/types/target-sources';
import type {
  ApprovalRequestCreateBody,
  BffConfirmedIntegration,
  ConfirmedIntegrationResponsePayload,
  ResourceCatalogResponsePayload,
} from '@/lib/bff/types/confirm';
import { bffErrorFromBody } from '@/app/api/_lib/problem';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';
import { extractConfirmedIntegration } from '@/lib/confirmed-integration-response';
import { extractResourceCatalog } from '@/lib/resource-catalog-response';

const BFF_URL = process.env.BFF_API_URL ?? '';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

async function throwBffError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({}));
  throw bffErrorFromBody(res.status, body);
}

async function get<T>(path: string, opts?: { raw?: boolean }): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, { headers: { Accept: 'application/json' } });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  const data = await res.json();
  return (opts?.raw ? data : camelCaseKeys(data)) as T;
}

async function getRaw(path: string): Promise<Response> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath} (raw)`);
  const res = await fetch(fullPath, { headers: { Accept: '*/*' } });
  console.log(`[BFF] ← GET ${fullPath} (${res.status}, raw)`);
  if (!res.ok) await throwBffError(res);
  return res;
}

async function send<T>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → ${method} ${fullPath}`);
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(fullPath, init);
  console.log(`[BFF] ← ${method} ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  if (res.status === 204) return undefined as T;
  // I-3 invariant: POST/PUT bodies are raw passthrough (snake_case), no camelCase.
  return await res.json() as T;
}

const post = <T>(path: string, body?: unknown) => send<T>('POST', path, body);
const put = <T>(path: string, body?: unknown) => send<T>('PUT', path, body);
const del = <T>(path: string) => send<T>('DELETE', path);

const buildQuery = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const httpBff: BffClient = {
  targetSources: {
    get: (id) => get(`/target-sources/${id}`),
    list: (serviceCode) => get(`/target-sources/services/${serviceCode}`),
    create: (body) => {
      if (isRecord(body) && typeof body.serviceCode === 'string') {
        const { serviceCode, ...rest } = body;
        return post<CreateTargetSourceResult>(`/target-sources/services/${serviceCode}/target-sources`, rest);
      }
      return post<CreateTargetSourceResult>('/target-sources', body);
    },
  },

  projects: {
    get: (id) => get(`/projects/${id}`),
    delete: (id) => del(`/projects/${id}`),
    create: (body) => post('/projects', body),
    approve: (id, body) => post(`/projects/${id}/approve`, body),
    reject: (id, body) => post(`/projects/${id}/reject`, body),
    confirmTargets: (id, body) => post(`/projects/${id}/confirm-targets`, body),
    completeInstallation: (id) => post(`/projects/${id}/complete-installation`, {}),
    confirmCompletion: (id) => post(`/projects/${id}/confirm-completion`, {}),
    credentials: (id) => get(`/target-sources/${id}/secrets`),
    history: (id, query) => get(`/projects/${id}/history${buildQuery(query)}`),
    resourceCredential: (id, body) => put(`/target-sources/${id}/resources/credential`, body),
    resourceExclusions: (id) => get(`/projects/${id}/resources/exclusions`),
    resources: (id) => get(`/projects/${id}/resources`),
    scan: (id) => post(`/projects/${id}/scan`, {}),
    terraformStatus: (id) => get(`/projects/${id}/terraform-status`),
    testConnection: (id, body) => post(`/projects/${id}/test-connection`, body),
  },

  users: {
    search: (query, excludeIds) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      excludeIds.forEach((id) => params.append('excludeIds', id));
      const qs = params.toString();
      return get(`/users/search${qs ? `?${qs}` : ''}`);
    },
    me: () => get('/user/me'),
    getServices: () => get('/user/services'),
    getServicesPage: (page, size, query) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (query) params.set('query', query);
      return get(`/user/services/page?${params.toString()}`);
    },
  },

  services: {
    permissions: {
      list: (serviceCode) => get(`/services/${serviceCode}/authorized-users`),
      add: (serviceCode, body) => post(`/services/${serviceCode}/authorized-users`, body),
      remove: (serviceCode, userId) => del(`/services/${serviceCode}/authorized-users/${userId}`),
    },
    settings: {
      aws: {
        get: (serviceCode) => get(`/services/${serviceCode}/settings/aws`),
        update: (serviceCode, body) => put(`/services/${serviceCode}/settings/aws`, body),
        verifyScanRole: (serviceCode) => post(`/services/${serviceCode}/settings/aws/verify-scan-role`, {}),
      },
    },
  },

  dashboard: {
    summary: () => get('/admin/dashboard/summary'),
    systems: (params) => {
      const qs = params.toString();
      return get(`/admin/dashboard/systems${qs ? `?${qs}` : ''}`);
    },
    systemsExport: (params) => {
      const qs = params.toString();
      return getRaw(`/admin/dashboard/systems/export${qs ? `?${qs}` : ''}`);
    },
  },

  dev: {
    getUsers: () => get('/dev/users'),
    switchUser: (body) => post('/dev/switch-user', body),
  },

  scan: {
    get: (id, scanId) => get(`/target-sources/${id}/scans/${scanId}`),
    getHistory: (id, query) => get(`/target-sources/${id}/scan/history${buildQuery(query)}`),
    create: (id, body) => post(`/target-sources/${id}/scan`, body),
    getStatus: (id) => get(`/target-sources/${id}/scanJob/latest`),
  },

  taskAdmin: {
    getApprovalRequestQueue: (params) => {
      const searchParams = new URLSearchParams();
      searchParams.set('status', params.status);
      if (params.requestType) searchParams.set('requestType', params.requestType);
      if (params.search) searchParams.set('search', params.search);
      if (params.page !== undefined) searchParams.set('page', String(params.page));
      if (params.size !== undefined) searchParams.set('size', String(params.size));
      if (params.sort) searchParams.set('sort', params.sort);
      return get(`/task-admin/approval-requests?${searchParams.toString()}`);
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

  guides: {
    get: (name) => get(`/admin/guides/${encodeURIComponent(name)}`),
    put: (name, body) => put(`/admin/guides/${encodeURIComponent(name)}`, body),
  },
};
