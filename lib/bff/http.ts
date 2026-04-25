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
import { BffError } from '@/lib/bff/errors';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';

const BFF_URL = process.env.BFF_API_URL ?? '';

interface LegacyErrorPayload {
  error?: string;
  message?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

async function throwBffError(res: Response): Promise<never> {
  const body = await res.json().catch((): LegacyErrorPayload => ({}));
  throw new BffError(
    res.status,
    body.error ?? 'INTERNAL_ERROR',
    body.message ?? `HTTP ${res.status}`,
  );
}

async function get<T>(path: string): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, { headers: { Accept: 'application/json' } });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) await throwBffError(res);
  const data = await res.json();
  return camelCaseKeys(data) as T;
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
      azure: {
        get: (serviceCode) => get(`/services/${serviceCode}/settings/azure`),
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
};
