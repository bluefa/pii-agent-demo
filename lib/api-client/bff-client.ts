import { NextResponse } from 'next/server';
import type { ApiClient } from '@/lib/api-client/types';
import {
  extractConfirmedIntegration,
  type ConfirmedIntegrationResponsePayload,
} from '@/lib/confirmed-integration-response';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import {
  extractResourceCatalog,
  type ResourceCatalogResponsePayload,
} from '@/lib/resource-catalog-response';
import { camelCaseKeys } from '@/lib/object-case';

const BFF_URL = process.env.BFF_API_URL;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const extractTargetSourceCreateRequest = (body: unknown): {
  serviceCode: string;
  requestBody: Record<string, unknown>;
} | null => {
  if (!isRecord(body) || typeof body.serviceCode !== 'string') return null;

  const { serviceCode, ...requestBody } = body;
  return { serviceCode, requestBody };
};

type BffMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

const bffFetch = async (
  method: BffMethod,
  path: string,
  body?: unknown,
): Promise<Response> => {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → ${method} ${fullPath}`);
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(fullPath, init);
  console.log(`[BFF] ← ${method} ${fullPath} (${res.status})`);
  return res;
};

const proxyGet = async (path: string): Promise<NextResponse> => {
  const res = await bffFetch('GET', path);

  if (!res.ok) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  const data = await res.json();
  const camelCasedData = camelCaseKeys(data);

  return new NextResponse(JSON.stringify(camelCasedData), {
    status: res.status,
    headers: { 'Content-Type': 'application/json' },
  });
};

const proxyPost = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await bffFetch('POST', path, body);
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyPut = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await bffFetch('PUT', path, body);
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyDelete = async (path: string): Promise<NextResponse> => {
  const res = await bffFetch('DELETE', path);
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyConfirmedIntegrationGet = async (path: string): Promise<NextResponse> => {
  const res = await bffFetch('GET', path);

  if (!res.ok) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  const payload = await res.json() as ConfirmedIntegrationResponsePayload;
  return NextResponse.json(extractConfirmedIntegration(payload), { status: res.status });
};

const proxyResourceCatalogGet = async (path: string): Promise<NextResponse> => {
  const res = await bffFetch('GET', path);

  if (!res.ok) {
    return new NextResponse(res.body, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
    });
  }

  const payload = await res.json() as ResourceCatalogResponsePayload;
  return NextResponse.json(extractResourceCatalog(payload), { status: res.status });
};

export const bffClient: ApiClient = {
  dashboard: {
    summary: () => proxyGet('/admin/dashboard/summary'),
    systems: (params) => {
      const qs = params.toString();
      return proxyGet(`/admin/dashboard/systems${qs ? `?${qs}` : ''}`);
    },
    systemsExport: (params) => {
      const qs = params.toString();
      return proxyGet(`/admin/dashboard/systems/export${qs ? `?${qs}` : ''}`);
    },
  },
  targetSources: {
    list: (serviceCode) => proxyGet(`/target-sources/services/${serviceCode}`),
    get: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}`),
    create: (body) => {
      const request = extractTargetSourceCreateRequest(body);
      if (!request) return proxyPost('/target-sources', body);
      return proxyPost(`/target-sources/services/${request.serviceCode}/target-sources`, request.requestBody);
    },
  },
  projects: {
    get: (targetSourceId) => proxyGet(`/projects/${targetSourceId}`),
    delete: (targetSourceId) => proxyDelete(`/projects/${targetSourceId}`),
    create: (body) => proxyPost('/projects', body),
    approve: (targetSourceId, body) => proxyPost(`/projects/${targetSourceId}/approve`, body),
    reject: (targetSourceId, body) => proxyPost(`/projects/${targetSourceId}/reject`, body),
    confirmTargets: (targetSourceId, body) => proxyPost(`/projects/${targetSourceId}/confirm-targets`, body),
    completeInstallation: (targetSourceId) => proxyPost(`/projects/${targetSourceId}/complete-installation`, {}),
    confirmCompletion: (targetSourceId) => proxyPost(`/projects/${targetSourceId}/confirm-completion`, {}),
    credentials: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/secrets`),
    history: (targetSourceId, query) => {
      const params = new URLSearchParams();
      if (query.type) params.set('type', query.type);
      if (query.limit) params.set('limit', query.limit);
      if (query.offset) params.set('offset', query.offset);
      const qs = params.toString();
      return proxyGet(`/projects/${targetSourceId}/history${qs ? `?${qs}` : ''}`);
    },
    resourceCredential: (targetSourceId, body) => proxyPut(`/target-sources/${targetSourceId}/resources/credential`, body),
    resourceExclusions: (targetSourceId) => proxyGet(`/projects/${targetSourceId}/resources/exclusions`),
    resources: (targetSourceId) => proxyGet(`/projects/${targetSourceId}/resources`),
    scan: (targetSourceId) => proxyPost(`/projects/${targetSourceId}/scan`, {}),
    terraformStatus: (targetSourceId) => proxyGet(`/projects/${targetSourceId}/terraform-status`),
    testConnection: (targetSourceId, body) => proxyPost(`/projects/${targetSourceId}/test-connection`, body),
  },
  users: {
    search: (query, excludeIds) => {
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      excludeIds.forEach((excludeId) => params.append('excludeIds', excludeId));
      const qs = params.toString();
      return proxyGet(`/users/search${qs ? `?${qs}` : ''}`);
    },
    getMe: () => proxyGet('/user/me'),
    getServices: () => proxyGet('/user/services'),
    getServicesPage: (page: number, size: number, query?: string) => {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('size', String(size));
      if (query) params.set('query', query);
      return proxyGet(`/user/services/page?${params.toString()}`);
    },
  },
  aws: {
    checkInstallation: (targetSourceId) => proxyPost(`/aws/projects/${targetSourceId}/check-installation`, {}),
    setInstallationMode: (targetSourceId, body) => proxyPost(`/aws/projects/${targetSourceId}/installation-mode`, body),
    getInstallationStatus: (targetSourceId) => proxyGet(`/aws/projects/${targetSourceId}/installation-status`),
    getTerraformScript: (targetSourceId) => proxyGet(`/aws/projects/${targetSourceId}/terraform-script`),
    verifyTfRole: (_targetSourceId, body) => proxyPost('/aws/verify-tf-role', body ?? {}),
  },
  azure: {
    checkInstallation: (targetSourceId) => proxyPost(`/target-sources/${targetSourceId}/azure/check-installation`, {}),
    getInstallationStatus: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/azure/installation-status`),
    getSettings: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/azure/settings`),
    getSubnetGuide: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/azure/subnet-guide`),
    getScanApp: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/azure/scan-app`),
    vmCheckInstallation: (targetSourceId) => proxyPost(`/target-sources/${targetSourceId}/azure/vm/check-installation`, {}),
    vmGetInstallationStatus: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/azure/vm/installation-status`),
    vmGetTerraformScript: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/azure/vm/terraform-script`),
  },
  gcp: {
    checkInstallation: (targetSourceId) => proxyPost(`/target-sources/${targetSourceId}/gcp/check-installation`, {}),
    getInstallationStatus: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/gcp/installation-status`),
    getScanServiceAccount: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/gcp/scan-service-account`),
    getTerraformServiceAccount: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/gcp/terraform-service-account`),
  },
  services: {
    permissions: {
      list: (serviceCode) => proxyGet(`/services/${serviceCode}/authorized-users`),
      add: (serviceCode, body) => proxyPost(`/services/${serviceCode}/authorized-users`, body),
      remove: (serviceCode, userId) => proxyDelete(`/services/${serviceCode}/authorized-users/${userId}`),
    },
    projects: {
      list: (serviceCode) => proxyGet(`/services/${serviceCode}/projects`),
    },
    settings: {
      aws: {
        get: (serviceCode) => proxyGet(`/services/${serviceCode}/settings/aws`),
        update: (serviceCode, body) => proxyPut(`/services/${serviceCode}/settings/aws`, body),
        verifyScanRole: (serviceCode) => proxyPost(`/services/${serviceCode}/settings/aws/verify-scan-role`, {}),
      },
      azure: {
        get: (serviceCode) => proxyGet(`/services/${serviceCode}/settings/azure`),
      },
    },
  },
  dev: {
    getUsers: () => proxyGet('/dev/users'),
    switchUser: (body) => proxyPost('/dev/switch-user', body),
  },
  scan: {
    get: (targetSourceId, scanId) => proxyGet(`/target-sources/${targetSourceId}/scans/${scanId}`),
    getHistory: (targetSourceId, query) => {
      const params = new URLSearchParams();
      if (query.limit) params.set('limit', String(query.limit));
      if (query.offset) params.set('offset', String(query.offset));
      const qs = params.toString();
      return proxyGet(`/target-sources/${targetSourceId}/scan/history${qs ? `?${qs}` : ''}`);
    },
    create: (targetSourceId, body) => proxyPost(`/target-sources/${targetSourceId}/scan`, body),
    getStatus: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/scanJob/latest`),
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
      return proxyGet(`/task-admin/approval-requests?${searchParams.toString()}`);
    },
  },
  confirm: {
    getResources: (targetSourceId) => proxyResourceCatalogGet(`/target-sources/${targetSourceId}/resources`),
    createApprovalRequest: (targetSourceId, body) => proxyPost(`/target-sources/${targetSourceId}/approval-requests`, body),
    getConfirmedIntegration: (targetSourceId) =>
      proxyConfirmedIntegrationGet(`/target-sources/${targetSourceId}/confirmed-integration`),
    getApprovedIntegration: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/approved-integration`),
    getApprovalHistory: (targetSourceId, page, size) =>
      proxyGet(`/target-sources/${targetSourceId}/approval-history?page=${page}&size=${size}`),
    getApprovalRequestLatest: (targetSourceId) =>
      proxyGet(`/target-sources/${targetSourceId}/approval-requests/latest`),
    getProcessStatus: (targetSourceId) => proxyGet(`/target-sources/${targetSourceId}/process-status`),
    approveApprovalRequest: (targetSourceId, body) => proxyPost(`/target-sources/${targetSourceId}/approval-requests/approve`, body),
    rejectApprovalRequest: (targetSourceId, body) => proxyPost(`/target-sources/${targetSourceId}/approval-requests/reject`, body),
    cancelApprovalRequest: (targetSourceId) => proxyPost(`/target-sources/${targetSourceId}/approval-requests/cancel`, {}),
    confirmInstallation: (targetSourceId) => proxyPost(`/target-sources/${targetSourceId}/pii-agent-installation/confirm`, {}),
    updateResourceCredential: (targetSourceId, body) => proxyPut(`/target-sources/${targetSourceId}/resources/credential`, body),
    testConnection: (targetSourceId, body) => proxyPost(`/target-sources/${targetSourceId}/test-connection`, body),
    getTestConnectionResults: (targetSourceId, page, size) =>
      proxyGet(`/target-sources/${targetSourceId}/test-connection/results?page=${page}&size=${size}`),
    getTestConnectionLatest: (targetSourceId) =>
      proxyGet(`/target-sources/${targetSourceId}/test-connection/latest`),
  },
  guides: {
    get: (name) => proxyGet(`/admin/guides/${encodeURIComponent(name)}`),
    put: (name, body) => proxyPut(`/admin/guides/${encodeURIComponent(name)}`, body),
  },
};
