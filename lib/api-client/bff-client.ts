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

const proxyGet = async (path: string): Promise<NextResponse> => {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF Client] GET ${path} -> ${fullPath}`);
  const res = await fetch(fullPath);
  console.log(`[BFF Client] Response ${res.status} from ${fullPath}`);
  
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
  const res = await fetch(`${BFF_URL}${toUpstreamInfraApiPath(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyPut = async (path: string, body: unknown): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${toUpstreamInfraApiPath(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyDelete = async (path: string): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${toUpstreamInfraApiPath(path)}`, { method: 'DELETE' });
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
};

const proxyConfirmedIntegrationGet = async (path: string): Promise<NextResponse> => {
  const res = await fetch(`${BFF_URL}${toUpstreamInfraApiPath(path)}`);

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
  const res = await fetch(`${BFF_URL}${toUpstreamInfraApiPath(path)}`);

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
    get: (projectId) => proxyGet(`/target-sources/${projectId}`),
    create: (body) => {
      const request = extractTargetSourceCreateRequest(body);
      if (!request) return proxyPost('/target-sources', body);
      return proxyPost(`/target-sources/services/${request.serviceCode}/target-sources`, request.requestBody);
    },
  },
  projects: {
    get: (projectId) => proxyGet(`/projects/${projectId}`),
    delete: (projectId) => proxyDelete(`/projects/${projectId}`),
    create: (body) => proxyPost('/projects', body),
    approve: (projectId, body) => proxyPost(`/projects/${projectId}/approve`, body),
    reject: (projectId, body) => proxyPost(`/projects/${projectId}/reject`, body),
    confirmTargets: (projectId, body) => proxyPost(`/projects/${projectId}/confirm-targets`, body),
    completeInstallation: (projectId) => proxyPost(`/projects/${projectId}/complete-installation`, {}),
    confirmCompletion: (projectId) => proxyPost(`/projects/${projectId}/confirm-completion`, {}),
    credentials: (projectId) => proxyGet(`/target-sources/${projectId}/secrets`),
    history: (projectId, query) => {
      const params = new URLSearchParams();
      if (query.type) params.set('type', query.type);
      if (query.limit) params.set('limit', query.limit);
      if (query.offset) params.set('offset', query.offset);
      const qs = params.toString();
      return proxyGet(`/projects/${projectId}/history${qs ? `?${qs}` : ''}`);
    },
    resourceCredential: (projectId, body) => proxyPut(`/target-sources/${projectId}/resources/credential`, body),
    resourceExclusions: (projectId) => proxyGet(`/projects/${projectId}/resources/exclusions`),
    resources: (projectId) => proxyGet(`/projects/${projectId}/resources`),
    scan: (projectId) => proxyPost(`/projects/${projectId}/scan`, {}),
    terraformStatus: (projectId) => proxyGet(`/projects/${projectId}/terraform-status`),
    testConnection: (projectId, body) => proxyPost(`/projects/${projectId}/test-connection`, body),
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
  sdu: {
    checkInstallation: (projectId) => proxyPost(`/sdu/target-sources/${projectId}/check-installation`, {}),
    getAthenaTables: (projectId) => proxyGet(`/sdu/target-sources/${projectId}/athena-tables`),
    executeConnectionTest: (projectId) => proxyPost(`/sdu/target-sources/${projectId}/connection-test/execute`, {}),
    getConnectionTest: (projectId) => proxyGet(`/sdu/target-sources/${projectId}/connection-test`),
    issueAkSk: (projectId, body) => proxyPost(`/sdu/target-sources/${projectId}/iam-user/issue-aksk`, body),
    getIamUser: (projectId) => proxyGet(`/sdu/target-sources/${projectId}/iam-user`),
    getInstallationStatus: (projectId) => proxyGet(`/sdu/target-sources/${projectId}/installation-status`),
    checkS3Upload: (projectId) => proxyPost(`/sdu/target-sources/${projectId}/s3-upload/check`, {}),
    getS3Upload: (projectId) => proxyGet(`/sdu/target-sources/${projectId}/s3-upload`),
    confirmSourceIp: (projectId, body) => proxyPost(`/sdu/target-sources/${projectId}/source-ip/confirm`, body),
    registerSourceIp: (projectId, body) => proxyPost(`/sdu/target-sources/${projectId}/source-ip/register`, body),
    getSourceIpList: (projectId) => proxyGet(`/sdu/target-sources/${projectId}/source-ip`),
  },
  aws: {
    checkInstallation: (projectId) => proxyPost(`/aws/projects/${projectId}/check-installation`, {}),
    setInstallationMode: (projectId, body) => proxyPost(`/aws/projects/${projectId}/installation-mode`, body),
    getInstallationStatus: (projectId) => proxyGet(`/aws/projects/${projectId}/installation-status`),
    getTerraformScript: (projectId) => proxyGet(`/aws/projects/${projectId}/terraform-script`),
    verifyTfRole: (_projectId, body) => proxyPost('/aws/verify-tf-role', body ?? {}),
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
  idc: {
    getSourceIpRecommendation: (ipType) =>
      proxyGet(`/idc/source-ip-recommendation${ipType ? `?ipType=${ipType}` : ''}`),
    checkInstallation: (projectId) => proxyPost(`/idc/target-sources/${projectId}/check-installation`, {}),
    confirmFirewall: (projectId) => proxyPost(`/idc/target-sources/${projectId}/confirm-firewall`, {}),
    confirmTargets: (projectId, body) => proxyPost(`/idc/target-sources/${projectId}/confirm-targets`, body),
    getInstallationStatus: (projectId) => proxyGet(`/idc/target-sources/${projectId}/installation-status`),
    getResources: (projectId) => proxyGet(`/idc/target-sources/${projectId}/resources`),
    updateResources: (projectId, body) => proxyPut(`/idc/target-sources/${projectId}/resources`, body),
    updateResourcesList: (projectId, body) => proxyPut(`/idc/target-sources/${projectId}/resources/list`, body),
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
      idc: {
        get: (serviceCode) => proxyGet(`/services/${serviceCode}/settings/idc`),
        update: (serviceCode, body) => proxyPut(`/services/${serviceCode}/settings/idc`, body),
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
    getResources: (projectId) => proxyResourceCatalogGet(`/target-sources/${projectId}/resources`),
    createApprovalRequest: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests`, body),
    getConfirmedIntegration: (projectId) =>
      proxyConfirmedIntegrationGet(`/target-sources/${projectId}/confirmed-integration`),
    getApprovedIntegration: (projectId) => proxyGet(`/target-sources/${projectId}/approved-integration`),
    getApprovalHistory: (projectId, page, size) =>
      proxyGet(`/target-sources/${projectId}/approval-history?page=${page}&size=${size}`),
    getApprovalRequestLatest: (projectId) =>
      proxyGet(`/target-sources/${projectId}/approval-requests/latest`),
    getProcessStatus: (projectId) => proxyGet(`/target-sources/${projectId}/process-status`),
    approveApprovalRequest: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests/approve`, body),
    rejectApprovalRequest: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests/reject`, body),
    cancelApprovalRequest: (projectId) => proxyPost(`/target-sources/${projectId}/approval-requests/cancel`, {}),
    confirmInstallation: (projectId) => proxyPost(`/target-sources/${projectId}/pii-agent-installation/confirm`, {}),
    updateResourceCredential: (projectId, body) => proxyPut(`/target-sources/${projectId}/resources/credential`, body),
    testConnection: (projectId, body) => proxyPost(`/target-sources/${projectId}/test-connection`, body),
    getTestConnectionResults: (projectId, page, size) =>
      proxyGet(`/target-sources/${projectId}/test-connection/results?page=${page}&size=${size}`),
    getTestConnectionLatest: (projectId) =>
      proxyGet(`/target-sources/${projectId}/test-connection/latest`),
  },
};
