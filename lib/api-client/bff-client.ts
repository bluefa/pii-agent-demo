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
  const res = await fetch(`${BFF_URL}${toUpstreamInfraApiPath(path)}`);
  return new NextResponse(res.body, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
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
    get: (projectId) => proxyGet(`/target-sources/${projectId}`),
    delete: (projectId) => proxyDelete(`/target-sources/${projectId}`),
    create: (body) => bffClient.targetSources.create(body),
    approve: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests/approve`, body),
    reject: (projectId, body) => proxyPost(`/target-sources/${projectId}/approval-requests/reject`, body),
    confirmTargets: (projectId, body) => proxyPost(`/projects/${projectId}/confirm-targets`, body),
    completeInstallation: (projectId) => proxyPost(`/projects/${projectId}/complete-installation`, {}),
    confirmCompletion: (projectId) => proxyPost(`/target-sources/${projectId}/pii-agent-installation/confirm`, {}),
    credentials: (projectId) => proxyGet(`/target-sources/${projectId}/secrets`),
    history: (projectId, query) => {
      const params = new URLSearchParams();
      if (query.type) params.set('type', query.type);
      if (query.limit) params.set('limit', query.limit);
      if (query.offset) params.set('offset', query.offset);
      const qs = params.toString();
      return proxyGet(`/target-sources/${projectId}/history${qs ? `?${qs}` : ''}`);
    },
    resourceCredential: (projectId, body) => proxyPut(`/target-sources/${projectId}/resources/credential`, body),
    resourceExclusions: (projectId) => proxyGet(`/target-sources/${projectId}/resources/exclusions`),
    resources: (projectId) => proxyGet(`/target-sources/${projectId}/resources`),
    scan: (projectId) => proxyPost(`/target-sources/${projectId}/scan`, {}),
    terraformStatus: (projectId) => proxyGet(`/target-sources/${projectId}/terraform-status`),
    testConnection: (projectId, body) => proxyPost(`/target-sources/${projectId}/test-connection`, body),
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
    checkInstallation: (projectId) => proxyPost(`/aws/target-sources/${projectId}/check-installation`, {}),
    setInstallationMode: (projectId, body) => proxyPost(`/aws/target-sources/${projectId}/installation-mode`, body),
    getInstallationStatus: (projectId) => proxyGet(`/aws/target-sources/${projectId}/installation-status`),
    getTerraformScript: (projectId) => proxyGet(`/aws/target-sources/${projectId}/terraform-script`),
    verifyTfRole: (projectId, body) => proxyPost(`/aws/target-sources/${projectId}/verify-execution-role`, body ?? {}),
  },
  azure: {
    checkInstallation: (projectId) => proxyPost(`/azure/target-sources/${projectId}/check-installation`, {}),
    getInstallationStatus: (projectId) => proxyGet(`/azure/target-sources/${projectId}/installation-status`),
    getSettings: (projectId) => proxyGet(`/azure/target-sources/${projectId}/settings`),
    getSubnetGuide: (projectId) => proxyGet(`/azure/target-sources/${projectId}/subnet-guide`),
    vmCheckInstallation: (projectId) => proxyPost(`/azure/target-sources/${projectId}/vm/check-installation`, {}),
    vmGetInstallationStatus: (projectId) => proxyGet(`/azure/target-sources/${projectId}/vm/installation-status`),
    vmGetTerraformScript: (projectId) => proxyGet(`/azure/target-sources/${projectId}/vm-terraform-script`),
  },
  gcp: {
    checkInstallation: (projectId) => proxyPost(`/gcp/target-sources/${projectId}/check-installation`, {}),
    getInstallationStatus: (projectId) => proxyGet(`/gcp/target-sources/${projectId}/installation-status`),
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
      list: (serviceCode) => proxyGet(`/services/${serviceCode}/target-sources`),
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
    get: (projectId, scanId) => proxyGet(`/target-sources/${projectId}/scan/${scanId}`),
    getHistory: (projectId, query) =>
      proxyGet(`/target-sources/${projectId}/scan/history?limit=${query.limit}&offset=${query.offset}`),
    create: (projectId, body) => proxyPost(`/target-sources/${projectId}/scan`, body),
    getStatus: (projectId) => proxyGet(`/target-sources/${projectId}/scanJob/latest`),
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
